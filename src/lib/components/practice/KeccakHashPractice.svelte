<script lang="ts">
  import { onMount } from 'svelte';
  import sha3 from 'js-sha3';

  type HashEntry = {
    input: string;
    output: string;
    timestamp: number;
  };

  const STORAGE_KEY = 'chainlab-keccak-history';

  let inputValue = '';
  let latestOutput = '';
  let history: HashEntry[] = [];

  const saveHistory = (entries: HashEntry[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  };

  const loadHistory = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      history = stored ? (JSON.parse(stored) as HashEntry[]) : [];
    } catch {
      history = [];
    }
  };

  const hashInput = () => {
    if (!inputValue.trim()) return;
    const output = sha3.keccak256(inputValue);
    latestOutput = output;
    const nextEntry: HashEntry = {
      input: inputValue,
      output,
      timestamp: Date.now()
    };
    history = [nextEntry, ...history].slice(0, 10);
    saveHistory(history);
  };

  const clearHistory = () => {
    history = [];
    latestOutput = '';
    localStorage.removeItem(STORAGE_KEY);
  };

  onMount(() => {
    loadHistory();
  });
</script>

<section class="hash-card">
  <div class="header">
    <div>
      <h3>Keccak256 playground</h3>
      <p class="subtle">
        Enter any input to see the Keccak256 hash output. Each result is saved locally so you
        can revisit recent inputs.
      </p>
    </div>
    <button class="ghost" on:click={clearHistory}>Clear history</button>
  </div>

  <label>
    Input
    <textarea
      rows="4"
      bind:value={inputValue}
      placeholder="Type or paste any text to hash"
    ></textarea>
  </label>

  <div class="button-row">
    <button class="primary" on:click={hashInput} disabled={!inputValue.trim()}>Hash input</button>
  </div>

  <div class="output">
    <span class="label">Latest output</span>
    <div class="hash">{latestOutput || '—'}</div>
  </div>
</section>

<section class="hash-card">
  <h3>Recent inputs</h3>
  {#if history.length === 0}
    <p class="subtle">No hashes yet. Try hashing an input to see the output here.</p>
  {:else}
    <div class="history">
      {#each history as entry}
        <div class="history-item">
          <div>
            <span class="label">Input</span>
            <p class="value">{entry.input}</p>
          </div>
          <div>
            <span class="label">Output</span>
            <p class="hash">{entry.output}</p>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .hash-card {
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

  label {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-size: 0.9rem;
  }

  textarea {
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 0.75rem;
    background: var(--surface);
    color: var(--text);
    resize: vertical;
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

  .ghost {
    background: transparent;
    border-color: transparent;
    color: var(--muted-text);
  }

  .output {
    border: 1px dashed var(--border);
    border-radius: 12px;
    padding: 0.75rem 1rem;
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
    font-size: 0.85rem;
    word-break: break-all;
  }

  .history {
    display: grid;
    gap: 0.75rem;
  }

  .history-item {
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1rem;
    background: var(--background);
    display: grid;
    gap: 0.75rem;
  }

  .value {
    margin: 0.35rem 0 0;
    white-space: pre-wrap;
    word-break: break-word;
  }

  @media (max-width: 720px) {
    .header {
      flex-direction: column;
    }
  }
</style>
