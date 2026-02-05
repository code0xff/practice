<script lang="ts">
  import { onDestroy } from 'svelte';

  type Vote = 'Yes' | 'No' | null;

  type NodeState = {
    id: string;
    role: string;
    prevote: Vote;
    precommit: Vote;
  };

  const NODE_IDS = ['A', 'B', 'C', 'D'];
  const QUORUM = 3;
  const PHASE_SECONDS = 20;

  let round = 1;
  let proposerIndex = 0;
  let phase: 'propose' | 'prevote' | 'precommit' | 'commit' | 'round-change' = 'propose';
  let message = '';
  let committed: { round: number; proposer: string; message: string }[] = [];
  let countdown = PHASE_SECONDS;
  let timer: ReturnType<typeof setInterval> | null = null;
  let nodes: NodeState[] = NODE_IDS.map((id, index) => ({
    id,
    role: index === 0 ? 'Proposer' : 'Validator',
    prevote: null,
    precommit: null
  }));

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
    message = randomMessage();
    phase = 'prevote';
    resetVotes();
    startTimer();
  };

  const setVote = (index: number, stage: 'prevote' | 'precommit', value: Vote) => {
    nodes = nodes.map((node, idx) => {
      if (idx !== index) return node;
      return { ...node, [stage]: value };
    });
  };

  const tallyVotes = (stage: 'prevote' | 'precommit') => {
    const yes = nodes.filter((node) => node[stage] === 'Yes').length;
    const no = nodes.filter((node) => node[stage] === 'No').length;
    const pending = nodes.filter((node) => node[stage] === null).length;
    return { yes, no, pending };
  };

  const advancePrevote = () => {
    if (phase !== 'prevote') return;
    const { yes, no, pending } = tallyVotes('prevote');
    if (pending > 0) return;
    if (yes >= QUORUM) {
      phase = 'precommit';
      startTimer();
    } else if (no >= 1) {
      triggerRoundChange();
    } else {
      triggerRoundChange();
    }
  };

  const advancePrecommit = () => {
    if (phase !== 'precommit') return;
    const { yes, no, pending } = tallyVotes('precommit');
    if (pending > 0) return;
    if (yes >= QUORUM) {
      phase = 'commit';
      committed = [
        { round, proposer: NODE_IDS[proposerIndex], message },
        ...committed
      ];
      stopTimer();
      nextRound();
    } else if (no >= 1) {
      triggerRoundChange();
    } else {
      triggerRoundChange();
    }
  };

  const triggerRoundChange = () => {
    phase = 'round-change';
    stopTimer();
    nextRound();
  };

  const nextRound = () => {
    round += 1;
    proposerIndex = (proposerIndex + 1) % NODE_IDS.length;
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
  };

  $: if (phase === 'prevote') {
    const { yes, no, pending } = tallyVotes('prevote');
    if (yes >= QUORUM) {
      advancePrevote();
    } else if (no >= 1 && pending === 0) {
      triggerRoundChange();
    }
  }

  $: if (phase === 'precommit') {
    const { yes, no, pending } = tallyVotes('precommit');
    if (yes >= QUORUM) {
      advancePrecommit();
    } else if (no >= 1 && pending === 0) {
      triggerRoundChange();
    }
  }

  onDestroy(() => {
    stopTimer();
  });
</script>

<section class="pbft-card">
  <div class="header">
    <div>
      <h3>PBFT round simulation</h3>
      <p class="subtle">
        Round {round} · Proposer {NODE_IDS[proposerIndex]} · Phase {phase}
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
  </div>
  <div class="button-row">
    <button class="primary" on:click={proposeBlock} disabled={phase !== 'propose'}>
      Propose block
    </button>
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
  }
</style>
