<script lang="ts">
  import { onDestroy } from 'svelte';

  type Vote = 'Yes' | 'No' | null;

  type NodeState = {
    id: string;
    role: string;
    prevote: Vote;
    precommit: Vote;
    lockedRound: number | null;
    lockedValue: string | null;
  };

  const NODE_IDS = ['A', 'B', 'C', 'D'];
  const QUORUM = 3;
  const PHASE_SECONDS = 20;

  let round = 1;
  let proposerIndex = 0;
  let phase: 'propose' | 'prevote' | 'precommit' | 'commit' | 'round-change' = 'propose';
  let message = '';
  let committed: { height: number; round: number; proposer: string; message: string }[] = [];
  let countdown = PHASE_SECONDS;
  let timer: ReturnType<typeof setInterval> | null = null;
  let nodes: NodeState[] = NODE_IDS.map((id, index) => ({
    id,
    role: index === 0 ? 'Proposer' : 'Validator',
    prevote: null,
    precommit: null,
    lockedRound: null,
    lockedValue: null
  }));
  let roundChangeReason = '';
  let prevoteTally = { yes: 0, no: 0, pending: NODE_IDS.length };
  let precommitTally = { yes: 0, no: 0, pending: NODE_IDS.length };

  const shortHash = (value: string) => {
    if (!value) return '—';
    if (value.length <= 12) return value;
    return `${value.slice(0, 8)}…${value.slice(-4)}`;
  };

  const updateRoles = () => {
    nodes = nodes.map((node, index) => ({
      ...node,
      role: index === proposerIndex ? 'Proposer' : 'Validator'
    }));
  };

  const resetVotes = () => {
    nodes = nodes.map((node) => ({ ...node, prevote: null, precommit: null }));
  };

  const stopTimer = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const startTimer = () => {
    stopTimer();
    countdown = PHASE_SECONDS;
    timer = setInterval(() => {
      if (phase !== 'prevote' && phase !== 'precommit') {
        return;
      }
      countdown -= 1;
      if (countdown <= 0) {
        triggerRoundChange();
      }
    }, 1000);
  };

  const randomMessage = () => {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  };

  const proposeBlock = () => {
    const highestLock = nodes
      .filter((node) => node.lockedValue)
      .sort((left, right) => (right.lockedRound ?? 0) - (left.lockedRound ?? 0))[0];
    message = highestLock?.lockedValue ?? randomMessage();
    phase = 'prevote';
    roundChangeReason = highestLock
      ? `Round ${highestLock.lockedRound} lock carried forward into the next proposal.`
      : '';
    resetVotes();
    startTimer();
  };

  const setVote = (index: number, stage: 'prevote' | 'precommit', value: Vote) => {
    nodes = nodes.map((node, idx) => {
      if (idx !== index) return node;
      return { ...node, [stage]: value };
    });
    
    if (stage === 'prevote') {
      advancePrevote();
    } else  {
      advancePrecommit();
    }
  };

  const tallyVotes = (stage: 'prevote' | 'precommit') => {
    const yes = nodes.filter((node) => node[stage] === 'Yes').length;
    const no = nodes.filter((node) => node[stage] === 'No').length;
    const pending = nodes.filter((node) => node[stage] === null).length;
    return { yes, no, pending };
  };

  const currentVote = (node: NodeState) => {
    if (phase === 'prevote') return node.prevote;
    if (phase === 'precommit') return node.precommit;
    return node.precommit ?? node.prevote;
  };

  const advancePrevote = () => {
    if (phase !== 'prevote') return;
    const { yes, no, pending } = tallyVotes('prevote');
    if (yes >= QUORUM) {
      nodes = nodes.map((node) =>
        node.prevote === 'Yes' ? { ...node, lockedRound: round, lockedValue: message } : node
      );
      phase = 'precommit';
      startTimer();
      roundChangeReason = '';
    } else if ((no >= QUORUM || pending === 0) && yes < QUORUM) {
      triggerRoundChange('Prevote quorum failed.');
    }
  };

  const advancePrecommit = () => {
    if (phase !== 'precommit') return;
    const { yes, no, pending } = tallyVotes('precommit');
    if (yes >= QUORUM) {
      phase = 'commit';
      committed = [
        { height: committed.length + 1, round, proposer: NODE_IDS[proposerIndex], message },
        ...committed
      ];
      nodes = nodes.map((node) =>
        node.precommit === 'Yes' ? { ...node, lockedRound: round, lockedValue: message } : node
      );
      stopTimer();
      newRound();
    } else if ((no >= QUORUM || pending === 0) && yes < QUORUM) {
      triggerRoundChange('Precommit quorum failed.');
    }
  };

  const triggerRoundChange = (reason = 'Timeout reached before quorum.') => {
    phase = 'round-change';
    roundChangeReason = reason;
    stopTimer();
    nextRound();
  };

  const newRound = () => {
    round = 1;
    proposerIndex = nextProposer();
    updateRoles();
    resetVotes();
    message = '';
    phase = 'propose';
    countdown = PHASE_SECONDS;
    roundChangeReason = '';
  }

  const nextRound = () => {
    round += 1;
    proposerIndex = nextProposer();
    updateRoles();
    resetVotes();
    message = '';
    phase = 'propose';
    countdown = PHASE_SECONDS;
  };

  const resetSimulation = () => {
    round = 1;
    proposerIndex = 0;
    updateRoles();
    resetVotes();
    message = '';
    committed = [];
    phase = 'propose';
    stopTimer();
    countdown = PHASE_SECONDS;
    roundChangeReason = '';
    nodes = nodes.map((node) => ({ ...node, lockedRound: null, lockedValue: null }));
  };

  const nextProposer = (): number => {
    return (proposerIndex + 1) % NODE_IDS.length;
  }

  onDestroy(() => {
    stopTimer();
  });

  $: prevoteTally = tallyVotes('prevote');
  $: precommitTally = tallyVotes('precommit');
</script>

<section class="pbft-card">
  <div class="header">
    <div>
      <h3>PBFT round simulation</h3>
      <p class="subtle">
        Block {committed.length + 1} · Round {round} · Proposer {NODE_IDS[proposerIndex]} · Phase {phase}
      </p>
    </div>
    <button class="ghost" on:click={resetSimulation}>Reset</button>
  </div>
  <div class="status-grid">
    <div class="status-item">
      <span class="label">Proposal</span>
      <span class="hash" title={message}>{shortHash(message)}</span>
    </div>
    <div class="status-item">
      <span class="label">Committed blocks</span>
      <span>{committed.length}</span>
    </div>
    <div class="status-item">
      <span class="label">Time remaining</span>
      <span>{phase === 'prevote' || phase === 'precommit' ? `${countdown}s` : '—'}</span>
    </div>
    <div class="status-item">
      <span class="label">Round change reason</span>
      <span>{roundChangeReason || '—'}</span>
    </div>
  </div>
  <div class="button-row">
    <button class="primary" on:click={proposeBlock} disabled={phase !== 'propose'}>
      Propose block
    </button>
  </div>
</section>

<section class="pbft-card">
  <h3>Consensus flow visualization</h3>
  <p class="subtle">
    PBFT moves from proposal to prevote to precommit. A quorum of {QUORUM}/{NODE_IDS.length}
    validators is required before the block can commit.
  </p>
  <div class="consensus-flow">
    <div class="phase-node" class:active={phase === 'propose'}>
      <span class="label">1. Propose</span>
      <strong>Node {NODE_IDS[proposerIndex]}</strong>
      <span class="hash">{shortHash(message)}</span>
    </div>
    <div class="phase-arrow">→</div>
    <div class="phase-node" class:active={phase === 'prevote'}>
      <span class="label">2. Prevote</span>
      <strong>{prevoteTally.yes}/{QUORUM} yes</strong>
      <div class="quorum-bar">
        <span style={`width: ${(prevoteTally.yes / QUORUM) * 100}%`}></span>
      </div>
    </div>
    <div class="phase-arrow">→</div>
    <div class="phase-node" class:active={phase === 'precommit'}>
      <span class="label">3. Precommit</span>
      <strong>{precommitTally.yes}/{QUORUM} yes</strong>
      <div class="quorum-bar">
        <span style={`width: ${(precommitTally.yes / QUORUM) * 100}%`}></span>
      </div>
    </div>
    <div class="phase-arrow">→</div>
    <div class="phase-node" class:active={phase === 'commit'}>
      <span class="label">4. Commit</span>
      <strong>{committed.length} blocks</strong>
      <span>{roundChangeReason || 'finalize block'}</span>
    </div>
  </div>
  <div class="validator-ring">
    {#each nodes as node}
      {@const vote = currentVote(node)}
      <div
        class="validator-dot"
        class:proposer={node.role === 'Proposer'}
        class:locked={!!node.lockedValue}
        class:yes={vote === 'Yes'}
        class:no={vote === 'No'}
        class:pending={vote === null}
      >
        <div>
          <strong>Node {node.id}</strong>
          <span>{node.role}</span>
        </div>
        <div class="vote-state">
          <span class="vote-chip">{vote ?? 'Pending'}</span>
          <small>Prevote: {node.prevote ?? 'Pending'}</small>
          <small>Precommit: {node.precommit ?? 'Pending'}</small>
        </div>
      </div>
    {/each}
  </div>
</section>

<section class="pbft-grid">
  {#each nodes as node, index}
    <div class="node-card">
      <div class="node-header">
        <h4>Node {node.id}</h4>
        <span class="badge">{node.role}</span>
      </div>
      {#if phase === 'prevote'}
        <div class="phase">
          <span class="label">Prevote</span>
          <div class="vote-row">
            <button
              class:active={node.prevote === 'Yes'}
              on:click={() => setVote(index, 'prevote', 'Yes')}
            >
              Yes
            </button>
            <button
              class:active={node.prevote === 'No'}
              on:click={() => setVote(index, 'prevote', 'No')}
            >
              No
            </button>
          </div>
          <ul class="vote-log">
            {#each nodes as peer}
              {#if peer.id !== node.id}
                <li>
                  {peer.id}: {peer.prevote ?? 'Pending'}
                </li>
              {/if}
            {/each}
          </ul>
        </div>
      {:else if phase === 'precommit'}
        <div class="phase">
          <span class="label">Precommit</span>
          <div class="vote-row">
            <button
              class:active={node.precommit === 'Yes'}
              on:click={() => setVote(index, 'precommit', 'Yes')}
            >
              Yes
            </button>
            <button
              class:active={node.precommit === 'No'}
              on:click={() => setVote(index, 'precommit', 'No')}
            >
              No
            </button>
          </div>
          <ul class="vote-log">
            {#each nodes as peer}
              {#if peer.id !== node.id}
                <li>
                  {peer.id}: {peer.precommit ?? 'Pending'}
                </li>
              {/if}
            {/each}
          </ul>
        </div>
      {:else}
        <p class="subtle">Votes open during prevote or precommit.</p>
      {/if}
      <div class="lock-box">
        <span class="label">Lock</span>
        <span class="hash">
          {#if node.lockedValue}
            Round {node.lockedRound}: {shortHash(node.lockedValue)}
          {:else}
            —
          {/if}
        </span>
      </div>
    </div>
  {/each}
</section>

<section class="pbft-card">
  <h3>Commit history</h3>
  {#if committed.length === 0}
    <p class="subtle">No commits yet. Complete prevote and precommit to commit.</p>
  {:else}
    <div class="commit-list">
      {#each committed as entry}
        <div class="commit-row">
          <span class="label">Block {entry.height}</span>
          <span class="label">Round {entry.round}</span>
          <span class="hash" title={entry.message}>{shortHash(entry.message)}</span>
          <span class="badge">Proposer {entry.proposer}</span>
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .pbft-card {
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 1.5rem;
    background: var(--surface);
    margin-top: 1.5rem;
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .status-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .status-item {
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 0.75rem;
    background: var(--background);
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted-text);
  }

  .hash {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 0.78rem;
    word-break: break-all;
  }

  .button-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .button-row button {
    border-radius: 999px;
    border: 1px solid transparent;
    padding: 0.55rem 1.4rem;
    font-weight: 600;
    cursor: pointer;
  }

  .primary {
    background: var(--primary);
    color: var(--primary-foreground);
    border-color: var(--primary);
  }

  .ghost {
    background: transparent;
    border-color: transparent;
    color: var(--muted-text);
  }

  .pbft-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .consensus-flow {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr);
    gap: 0.75rem;
    align-items: stretch;
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 1rem;
    background: var(--background);
  }

  .phase-node {
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 0.85rem;
    background: var(--surface);
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .phase-node.active {
    border-color: #2563eb;
    box-shadow: inset 0 0 0 1px #2563eb;
  }

  .phase-arrow {
    display: grid;
    place-items: center;
    color: var(--muted-text);
  }

  .quorum-bar {
    height: 8px;
    border-radius: 999px;
    background: var(--border);
    overflow: hidden;
  }

  .quorum-bar span {
    display: block;
    height: 100%;
    max-width: 100%;
    background: #16a34a;
  }

  .validator-ring {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.75rem;
  }

  .validator-dot {
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 0.65rem 0.85rem;
    background: var(--background);
    display: grid;
    gap: 0.5rem;
  }

  .validator-dot > div:first-child {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    align-items: center;
  }

  .validator-dot > div:first-child span,
  .vote-state small {
    color: var(--muted-text);
    font-size: 0.74rem;
  }

  .validator-dot.proposer {
    border-color: #d97706;
  }

  .validator-dot.locked {
    background: var(--surface);
    box-shadow: inset 0 0 0 1px #16a34a;
  }

  .validator-dot.yes {
    background: color-mix(in srgb, #16a34a 12%, var(--background));
  }

  .validator-dot.no {
    background: color-mix(in srgb, #b00020 10%, var(--background));
    border-color: #b00020;
  }

  .validator-dot.pending {
    opacity: 0.82;
  }

  .vote-state {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    flex-wrap: wrap;
  }

  .vote-chip {
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0.2rem 0.55rem;
    font-size: 0.72rem;
    font-weight: 700;
  }

  .validator-dot.yes .vote-chip {
    border-color: #16a34a;
    color: #166534;
  }

  .validator-dot.no .vote-chip {
    border-color: #b00020;
    color: #b00020;
  }

  .node-card {
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 1rem;
    background: var(--surface);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .node-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .badge {
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0.2rem 0.6rem;
    font-size: 0.7rem;
    color: var(--muted-text);
  }

  .phase {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .vote-row {
    display: flex;
    gap: 0.5rem;
  }

  .vote-row button {
    flex: 1;
    border-radius: 12px;
    border: 1px solid var(--border);
    padding: 0.4rem 0.6rem;
    background: transparent;
  }

  .vote-row button.active {
    background: var(--text);
    color: var(--background);
  }

  .vote-log {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: var(--muted-text);
  }

  .commit-list {
    display: grid;
    gap: 0.75rem;
  }

  .lock-box {
    border: 1px dashed var(--border);
    border-radius: 10px;
    padding: 0.65rem;
    background: var(--background);
    display: grid;
    gap: 0.35rem;
  }

  .commit-row {
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 0.75rem;
    background: var(--background);
    display: grid;
    gap: 0.4rem;
  }

  @media (max-width: 720px) {
    .header {
      flex-direction: column;
    }

    .consensus-flow {
      grid-template-columns: 1fr;
    }

    .phase-arrow {
      transform: rotate(90deg);
    }
  }
</style>
