<script lang="ts">
  import { onMount } from 'svelte';

  type Utxo = {
    id: string;
    address: string;
    amount: number;
  };

  type TxRecord = {
    id: string;
    inputs: Utxo[];
    outputs: Utxo[];
    timestamp: number;
  };

  const STORAGE_KEY = 'chainlab-utxo-ledger';
  const TX_KEY = 'chainlab-utxo-transactions';

  let utxos: Utxo[] = [];
  let transactions: TxRecord[] = [];
  let initAddress = '';
  let initAmount = 1;
  let destinationAddress = '';
  let sendAmount = 0.5;
  let selectedInputs = new Set<string>();
  let errorMessage = '';

  const generateRandomAddress = () => {
    const bytes = new Uint8Array(10);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    return `bc1q${hex}`;
  };

  const saveState = (nextUtxos: Utxo[], nextTx: TxRecord[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUtxos));
    localStorage.setItem(TX_KEY, JSON.stringify(nextTx));
  };

  const loadState = () => {
    try {
      const storedUtxos = localStorage.getItem(STORAGE_KEY);
      const storedTx = localStorage.getItem(TX_KEY);
      utxos = storedUtxos ? (JSON.parse(storedUtxos) as Utxo[]) : [];
      transactions = storedTx ? (JSON.parse(storedTx) as TxRecord[]) : [];
    } catch {
      utxos = [];
      transactions = [];
    }
  };

  const addInitialUtxo = () => {
    errorMessage = '';
    if (!initAddress.trim()) {
      errorMessage = 'Enter an address before initializing.';
      return;
    }
    if (initAmount <= 0) {
      errorMessage = 'Initial amount must be greater than zero.';
      return;
    }
    const newUtxo: Utxo = {
      id: crypto.randomUUID(),
      address: initAddress.trim(),
      amount: Number(initAmount.toFixed(8))
    };
    utxos = [...utxos, newUtxo];
    saveState(utxos, transactions);
  };

  const toggleInput = (id: string) => {
    if (selectedInputs.has(id)) {
      selectedInputs.delete(id);
    } else {
      selectedInputs.add(id);
    }
    selectedInputs = new Set(selectedInputs);
  };

  const sendTransaction = () => {
    errorMessage = '';
    if (selectedInputs.size === 0) {
      errorMessage = 'Select at least one UTXO to spend.';
      return;
    }
    if (!destinationAddress.trim()) {
      errorMessage = 'Enter a destination address.';
      return;
    }
    if (sendAmount <= 0) {
      errorMessage = 'Send amount must be greater than zero.';
      return;
    }
    const inputs = utxos.filter((utxo) => selectedInputs.has(utxo.id));
    const totalInput = inputs.reduce((sum, utxo) => sum + utxo.amount, 0);
    if (totalInput < sendAmount) {
      errorMessage = 'Selected inputs do not cover the send amount.';
      return;
    }

    const outputs: Utxo[] = [];
    outputs.push({
      id: crypto.randomUUID(),
      address: destinationAddress.trim(),
      amount: Number(sendAmount.toFixed(8))
    });

    const change = Number((totalInput - sendAmount).toFixed(8));
    if (change > 0) {
      const changeAddress = inputs[0]?.address ?? initAddress.trim();
      outputs.push({
        id: crypto.randomUUID(),
        address: changeAddress,
        amount: change
      });
    }

    const nextUtxos = utxos.filter((utxo) => !selectedInputs.has(utxo.id)).concat(outputs);
    const tx: TxRecord = {
      id: crypto.randomUUID(),
      inputs,
      outputs,
      timestamp: Date.now()
    };
    utxos = nextUtxos;
    transactions = [tx, ...transactions].slice(0, 5);
    selectedInputs = new Set();
    saveState(utxos, transactions);
  };

  const clearLedger = () => {
    utxos = [];
    transactions = [];
    selectedInputs = new Set();
    initAddress = '';
    destinationAddress = '';
    errorMessage = '';
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TX_KEY);
  };

  onMount(() => {
    loadState();
    initAddress = generateRandomAddress();
    destinationAddress = generateRandomAddress();
  });
</script>

<section class="utxo-card">
  <div class="header">
    <div>
      <h3>Initialize UTXOs</h3>
      <p class="subtle">
        Start by creating one or more UTXOs for your wallet. You can use a random address or
        enter your own.
      </p>
    </div>
    <button class="ghost" on:click={clearLedger}>Clear ledger</button>
  </div>
  <div class="form-grid">
    <label>
      Wallet address
      <input type="text" bind:value={initAddress} placeholder="bc1q..." />
    </label>
    <label>
      Amount (BTC)
      <input type="number" min="0" step="0.00000001" bind:value={initAmount} />
    </label>
    <div class="button-row">
      <button class="secondary" on:click={() => (initAddress = generateRandomAddress())}>
        Random address
      </button>
      <button class="primary" on:click={addInitialUtxo}>Initialize</button>
    </div>
  </div>
</section>

<section class="utxo-card">
  <h3>Spend UTXOs</h3>
  <p class="subtle">Select inputs, set a destination, and simulate a transfer.</p>
  <div class="utxo-grid">
    {#if utxos.length === 0}
      <p class="subtle">No UTXOs yet. Initialize the ledger to begin.</p>
    {:else}
      {#each utxos as utxo}
        <label class="utxo-item">
          <input
            type="checkbox"
            checked={selectedInputs.has(utxo.id)}
            on:change={() => toggleInput(utxo.id)}
          />
          <span class="utxo-address">{utxo.address}</span>
          <span class="utxo-amount">{utxo.amount} BTC</span>
        </label>
      {/each}
    {/if}
  </div>
  <div class="form-grid">
    <label>
      Destination address
      <input type="text" bind:value={destinationAddress} placeholder="bc1q..." />
    </label>
    <label>
      Send amount (BTC)
      <input type="number" min="0" step="0.00000001" bind:value={sendAmount} />
    </label>
    <div class="button-row">
      <button class="secondary" on:click={() => (destinationAddress = generateRandomAddress())}>
        Random destination
      </button>
      <button class="primary" on:click={sendTransaction} disabled={utxos.length === 0}>
        Send
      </button>
    </div>
  </div>
  {#if errorMessage}
    <p class="error">{errorMessage}</p>
  {/if}
</section>

<section class="utxo-card">
  <h3>Latest transfers</h3>
  {#if transactions.length === 0}
    <p class="subtle">No transfers yet. Send a transaction to see the UTXO flow.</p>
  {:else}
    {#each transactions as tx}
      <div class="tx">
        <div class="tx-column">
          <h4>Inputs</h4>
          {#each tx.inputs as input}
            <div class="pill">
              <span class="hash">{input.address}</span>
              <strong>{input.amount} BTC</strong>
            </div>
          {/each}
        </div>
        <div class="tx-arrow">→</div>
        <div class="tx-column">
          <h4>Outputs</h4>
          {#each tx.outputs as output}
            <div class="pill">
              <span class="hash">{output.address}</span>
              <strong>{output.amount} BTC</strong>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  {/if}
</section>

<style>
  .utxo-card {
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

  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-size: 0.9rem;
  }

  input[type='text'],
  input[type='number'] {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.6rem 0.75rem;
    background: var(--surface);
    color: var(--text);
  }

  .button-row {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    align-items: flex-end;
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

  .utxo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 0.75rem;
  }

  .utxo-item {
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 0.75rem;
    background: var(--background);
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .utxo-address {
    font-size: 0.8rem;
    color: var(--muted-text);
    word-break: break-all;
  }

  .utxo-amount {
    font-weight: 600;
  }

  .error {
    color: #b00020;
    font-weight: 600;
  }

  .tx {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 1rem;
    align-items: center;
    border: 1px dashed var(--border);
    border-radius: 14px;
    padding: 1rem;
    background: var(--background);
  }

  .tx-column {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .tx-column h4 {
    margin: 0;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted-text);
  }

  .tx-arrow {
    font-size: 1.5rem;
    color: var(--muted-text);
  }

  .pill {
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0.35rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    background: var(--surface);
  }

  .hash {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 0.72rem;
    word-break: break-all;
  }

  @media (max-width: 720px) {
    .tx {
      grid-template-columns: 1fr;
      text-align: center;
    }
  }
</style>
