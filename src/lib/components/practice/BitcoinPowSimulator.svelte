<script lang="ts">
  import { onDestroy, onMount } from 'svelte';

  type PowBlock = {
    height: number;
    timestamp: number;
    nonce: number;
    hash: string;
    difficulty: number;
    blockTimeMs: number;
    miner: string;
  };

  type WorkerStat = {
    id: string;
    latestNonce: number;
    latestHash: string;
  };

  const STORAGE_KEY = 'chainlab-pow-blocks';
  const DEFAULT_TARGET_BLOCK_TIME = 10;
  const DEFAULT_DIFFICULTY = 3;
  const MAX_DIFFICULTY = 10;
  const MIN_DIFFICULTY = 1;

  let blocks: PowBlock[] = [];
  let isRunning = false;
  let difficulty = DEFAULT_DIFFICULTY;
  let targetBlockTime = DEFAULT_TARGET_BLOCK_TIME;
  let nodeCount = 2;
  let lastBlockTimestamp = Date.now();
  let activeWorkers: Worker[] = [];
  let workerStats: WorkerStat[] = [];
  let latestHashPreview = '';

  // ✅ 라운드/레이스 방지용
  let roundId = 0;
  let hasWinner = false;

  const saveBlocks = (nextBlocks: PowBlock[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextBlocks));
  };

  const loadBlocks = (): PowBlock[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as PowBlock[]) : [];
    } catch {
      return [];
    }
  };

  const shortHash = (value: string) => {
    if (!value) return '—';
    if (value.length <= 14) return value;
    return `${value.slice(0, 8)}…${value.slice(-4)}`;
  };

  const adjustDifficulty = (blockTimeMs: number) => {
    const targetMs = targetBlockTime * 1000;
    if (blockTimeMs < targetMs * 0.8) {
      difficulty = Math.min(MAX_DIFFICULTY, difficulty + 1);
    } else if (blockTimeMs > targetMs * 1.2) {
      difficulty = Math.max(MIN_DIFFICULTY, difficulty - 1);
    }
  };

  const createMiningWorker = () => {
    const source = `
      const toHex = (buffer) =>
        Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('');

      const hash256 = async (text) => {
        const first = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        const second = await crypto.subtle.digest('SHA-256', first);
        return toHex(second);
      };

      let running = false;

      onmessage = async (event) => {
        const { type, payload } = event.data ?? {};
        if (type === 'stop') {
          running = false;
          return;
        }
        if (type !== 'start') return;

        running = true;

        const {
          roundId,
          workerId,
          height,
          prevHash,
          difficulty,
          startNonce,
          step,
          progressIntervalMs = 100,
        } = payload;

        let nonce = startNonce;
        let lastProgressAt = 0;

        while (running) {
          const input = height + ':' + prevHash + ':' + nonce;
          const hash = await hash256(input);

          const now = Date.now();
          if (now - lastProgressAt >= progressIntervalMs) {
            postMessage({ type: 'progress', payload: { roundId, workerId, nonce, hash } });
            lastProgressAt = now;
          }

          if (hash.startsWith('0'.repeat(difficulty))) {
            postMessage({ type: 'found', payload: { roundId, workerId, nonce, hash } });
            running = false;
            return;
          }

          nonce += step;
        }
      };
    `;

    const blob = new Blob([source], { type: 'application/javascript' });
    return new Worker(URL.createObjectURL(blob));
  };

  const stopWorkers = () => {
    activeWorkers.forEach((worker) => {
      try {
        worker.postMessage({ type: 'stop' });
      } catch {
        // ignore
      }
      worker.terminate();
    });
    activeWorkers = [];
  };

  const startRound = () => {
    const prevHash = blocks.length ? blocks[blocks.length - 1].hash : '0'.repeat(64);
    const height = blocks.length + 1;

    // ✅ 새 라운드 토큰
    roundId += 1;
    const myRound = roundId;
    hasWinner = false;

    stopWorkers();

    workerStats = Array.from({ length: nodeCount }, (_, index) => ({
      id: `Node-${index + 1}`,
      latestNonce: 0,
      latestHash: ''
    }));

    for (let i = 0; i < nodeCount; i += 1) {
      const worker = createMiningWorker();
      const workerId = `Node-${i + 1}`;

      // ✅ worker가 조용히 죽는 문제 추적
      worker.onerror = (e) => {
        console.error('[worker error]', workerId, e);
      };
      worker.onmessageerror = (e) => {
        console.error('[worker messageerror]', workerId, e);
      };

      worker.onmessage = (event: MessageEvent) => {
        if (!isRunning) return;

        const { type, payload } = event.data ?? {};
        if (!payload) return;

        // ✅ 라운드 불일치 메시지는 무시
        if (payload.roundId !== myRound) return;

        if (type === 'progress') {
          const progress = payload as { roundId: number; workerId: string; nonce: number; hash: string };

          workerStats = workerStats.map((stat) =>
            stat.id === progress.workerId
              ? { ...stat, latestNonce: progress.nonce, latestHash: progress.hash }
              : stat
          );

          latestHashPreview = progress.hash;
          return;
        }

        if (type === 'found') {
          if (hasWinner) return; // ✅ 이미 승자 처리했으면 무시
          hasWinner = true;

          // ✅ 즉시 다른 워커들 중지 (중요)
          stopWorkers();

          const found = payload as { roundId: number; workerId: string; nonce: number; hash: string };
          const now = Date.now();
          const blockTimeMs = now - lastBlockTimestamp;

          const nextBlock: PowBlock = {
            height,
            timestamp: now,
            nonce: found.nonce,
            hash: found.hash,
            difficulty,
            blockTimeMs,
            miner: found.workerId
          };

          blocks = [...blocks, nextBlock];
          saveBlocks(blocks);
          lastBlockTimestamp = now;
          adjustDifficulty(blockTimeMs);

          if (isRunning) {
            startRound();
          }
        }
      };

      const randomStart = Math.floor(Math.random() * 1_000_000_000);
      worker.postMessage({
        type: 'start',
        payload: {
          roundId: myRound,             // ✅ 라운드 토큰 전달
          workerId,
          height,
          prevHash,
          difficulty,
          startNonce: randomStart + i,
          step: nodeCount,
          progressIntervalMs: 100       // ✅ UI 업데이트 주기
        }
      });

      activeWorkers.push(worker);
    }
  };

  const start = () => {
    if (isRunning) return;
    isRunning = true;
    if (!blocks.length) {
      lastBlockTimestamp = Date.now();
    }
    startRound();
  };

  const stop = () => {
    isRunning = false;
    stopWorkers();
  };

  const clearBlocks = () => {
    stop();
    blocks = [];
    latestHashPreview = '';
    difficulty = DEFAULT_DIFFICULTY;
    lastBlockTimestamp = Date.now();
    workerStats = [];
    localStorage.removeItem(STORAGE_KEY);
  };

  onMount(() => {
    blocks = loadBlocks();
    if (blocks.length) {
      lastBlockTimestamp = blocks[blocks.length - 1].timestamp;
      difficulty = blocks[blocks.length - 1].difficulty;
    }
  });

  onDestroy(() => {
    stop();
  });
</script>

<section class="pow-controls">
  <div class="control-card">
    <div>
      <h3>Multi-node Hash256 mining</h3>
      <p class="subtle">
        Nodes mine in parallel with double SHA-256 (Hash256). Winning blocks are broadcast and all
        nodes immediately begin the next round.
      </p>
    </div>
    <div class="control-grid">
      <label>
        Target block time (seconds)
        <input type="number" min="2" max="60" step="1" bind:value={targetBlockTime} disabled={isRunning} />
      </label>
      <label>
        Node count (workers)
        <input type="number" min="1" max="4" step="1" bind:value={nodeCount} disabled={isRunning} />
      </label>
      <div class="stat">
        <span class="stat-label">Difficulty</span>
        <span class="stat-value">{difficulty}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Latest hash</span>
        <span class="stat-value hash" title={latestHashPreview}>{shortHash(latestHashPreview)}</span>
      </div>
    </div>
    <div class="button-row">
      <button class="primary" on:click={start} disabled={isRunning}>Start</button>
      <button class="secondary" on:click={stop} disabled={!isRunning}>Stop</button>
      <button class="ghost" on:click={clearBlocks}>Reset</button>
    </div>
  </div>
</section>

<section>
  <h3>Worker status</h3>
  {#if workerStats.length === 0}
    <p class="subtle">No active workers. Start mining to spawn worker threads.</p>
  {:else}
    <div class="table">
      <div class="table-row header">
        <span>Node</span>
        <span>Nonce</span>
        <span>Latest hash</span>
      </div>
      {#each workerStats as stat (stat.id)}
        <div class="table-row workers">
          <span>{stat.id}</span>
          <span>{stat.latestNonce}</span>
          <span class="hash" title={stat.latestHash}>{shortHash(stat.latestHash)}</span>
        </div>
      {/each}
    </div>
  {/if}
</section>

<section>
  <h3>Generated blocks</h3>
  {#if !blocks.length}
    <p class="subtle">No blocks yet. Start the simulation to mine the first one.</p>
  {:else}
    <div class="table">
      <div class="table-row header">
        <span>Height</span>
        <span>Miner</span>
        <span>Nonce</span>
        <span>Difficulty</span>
        <span>Block time</span>
        <span>Hash</span>
      </div>
      {#each blocks as block (block.hash)}
        <div class="table-row">
          <span>{block.height}</span>
          <span>{block.miner}</span>
          <span>{block.nonce}</span>
          <span>{block.difficulty}</span>
          <span>{(block.blockTimeMs / 1000).toFixed(2)}s</span>
          <span class="hash" title={block.hash}>{shortHash(block.hash)}</span>
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .pow-controls {
    margin-top: 1.5rem;
  }

  .control-card {
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 1.5rem;
    background: var(--surface);
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    box-shadow: var(--shadow);
  }

  .control-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-size: 0.9rem;
  }

  input {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.6rem 0.75rem;
    background: var(--surface);
    color: var(--text);
  }

  .stat {
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 0.75rem;
    background: var(--background);
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .stat-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted-text);
  }

  .stat-value {
    font-weight: 600;
  }

  .hash {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 0.78rem;
    word-break: break-all;
  }

  .button-row {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .button-row button {
    border-radius: 999px;
    border: 1px solid transparent;
    padding: 0.55rem 1.4rem;
    font-weight: 600;
    cursor: pointer;
  }

  .button-row button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .primary {
    background: var(--primary);
    color: var(--primary-foreground);
    border-color: var(--primary);
  }

  .secondary {
    background: transparent;
    border-color: var(--border);
    color: var(--text);
  }

  .ghost {
    background: transparent;
    border-color: transparent;
    color: var(--muted-text);
  }

  .table {
    margin-top: 1rem;
    display: grid;
    gap: 0.5rem;
  }

  .table-row {
    display: grid;
    grid-template-columns: 80px 100px 120px 120px 120px 1fr;
    gap: 0.75rem;
    align-items: start;
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 0.75rem 1rem;
    background: var(--surface);
  }

  .table-row.workers {
    grid-template-columns: 120px 140px 1fr;
  }

  .table-row.header {
    background: var(--background);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted-text);
  }

  @media (max-width: 720px) {
    .table-row,
    .table-row.workers {
      grid-template-columns: 1fr;
    }
  }
</style>
