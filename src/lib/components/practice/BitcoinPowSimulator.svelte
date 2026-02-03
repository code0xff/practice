<script lang="ts">
  import { onDestroy, onMount } from 'svelte';

  type PowBlock = {
    height: number;
    timestamp: number;
    nonce: number;
    hash: string;
    difficulty: number;
    blockTimeMs: number;
  };

  const STORAGE_KEY = 'chainlab-pow-blocks';
  const DEFAULT_TARGET_BLOCK_TIME = 10;
  const DEFAULT_DIFFICULTY = 3;
  const MAX_DIFFICULTY = 6;
  const MIN_DIFFICULTY = 1;
  const HASHES_PER_TICK = 500;
  const TICK_INTERVAL_MS = 80;

  let blocks: PowBlock[] = [];
  let isRunning = false;
  let difficulty = DEFAULT_DIFFICULTY;
  let targetBlockTime = DEFAULT_TARGET_BLOCK_TIME;
  let nonceCursor = 0;
  let lastBlockTimestamp = Date.now();
  let latestHashPreview = '';
  let intervalId: ReturnType<typeof setInterval> | null = null;

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

  const computeHash = (nonce: number, prevHash: string, height: number) => {
    const input = `${height}-${prevHash}-${nonce}`;
    let hash = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const hex = (hash >>> 0).toString(16).padStart(8, '0');
    return `${hex}${hex}`;
  };

  const adjustDifficulty = (blockTimeMs: number) => {
    const targetMs = targetBlockTime * 1000;
    if (blockTimeMs < targetMs * 0.8) {
      difficulty = Math.min(MAX_DIFFICULTY, difficulty + 1);
    } else if (blockTimeMs > targetMs * 1.2) {
      difficulty = Math.max(MIN_DIFFICULTY, difficulty - 1);
    }
  };

  const mineTick = () => {
    if (!isRunning) return;
    const prevHash = blocks.length ? blocks[blocks.length - 1].hash : 'genesis';
    const height = blocks.length;

    for (let i = 0; i < HASHES_PER_TICK; i += 1) {
      const hash = computeHash(nonceCursor, prevHash, height);
      latestHashPreview = hash;
      if (hash.startsWith('0'.repeat(difficulty))) {
        const now = Date.now();
        const blockTimeMs = now - lastBlockTimestamp;
        const nextBlock: PowBlock = {
          height: height + 1,
          timestamp: now,
          nonce: nonceCursor,
          hash,
          difficulty,
          blockTimeMs
        };
        blocks = [...blocks, nextBlock];
        saveBlocks(blocks);
        lastBlockTimestamp = now;
        nonceCursor = 0;
        adjustDifficulty(blockTimeMs);
        return;
      }
      nonceCursor += 1;
    }
  };

  const start = () => {
    if (isRunning) return;
    isRunning = true;
    if (!blocks.length) {
      lastBlockTimestamp = Date.now();
    }
    intervalId = setInterval(mineTick, TICK_INTERVAL_MS);
  };

  const stop = () => {
    isRunning = false;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const clearBlocks = () => {
    stop();
    blocks = [];
    nonceCursor = 0;
    latestHashPreview = '';
    difficulty = DEFAULT_DIFFICULTY;
    lastBlockTimestamp = Date.now();
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
      <h3>Simulation controls</h3>
      <p class="subtle">
        Set a target block time, then start mining to watch difficulty adapt and blocks appear.
      </p>
    </div>
    <div class="control-grid">
      <label>
        Target block time (seconds)
        <input
          type="number"
          min="2"
          max="60"
          step="1"
          bind:value={targetBlockTime}
          disabled={isRunning}
        />
      </label>
      <div class="stat">
        <span class="stat-label">Difficulty</span>
        <span class="stat-value">{difficulty}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Current nonce</span>
        <span class="stat-value">{nonceCursor}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Latest hash</span>
        <span class="stat-value hash">{latestHashPreview || '—'}</span>
      </div>
    </div>
    <div class="button-row">
      <button class="primary" on:click={start} disabled={isRunning}>Start</button>
      <button class="secondary" on:click={stop} disabled={!isRunning}>Stop</button>
      <button class="ghost" on:click={clearBlocks}>Clear blocks</button>
    </div>
  </div>
</section>

<section>
  <h3>Generated blocks</h3>
  {#if !blocks.length}
    <p class="subtle">No blocks yet. Start the simulation to mine the first one.</p>
  {:else}
    <div class="table">
      <div class="table-row header">
        <span>Height</span>
        <span>Nonce</span>
        <span>Difficulty</span>
        <span>Block time</span>
        <span>Hash</span>
      </div>
      {#each blocks as block (block.hash)}
        <div class="table-row">
          <span>{block.height}</span>
          <span>{block.nonce}</span>
          <span>{block.difficulty}</span>
          <span>{(block.blockTimeMs / 1000).toFixed(2)}s</span>
          <span class="hash">{block.hash}</span>
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
    grid-template-columns: 80px 120px 120px 120px 1fr;
    gap: 0.75rem;
    align-items: start;
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 0.75rem 1rem;
    background: var(--surface);
  }

  .table-row.header {
    background: var(--background);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted-text);
  }

  @media (max-width: 720px) {
    .table-row {
      grid-template-columns: 1fr;
    }
  }
</style>
