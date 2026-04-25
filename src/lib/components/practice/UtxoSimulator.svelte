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
    outputs: (Utxo & { purpose: 'recipient' | 'change' })[];
    timestamp: number;
    fee: number;
  };

  const STORAGE_KEY = 'chainlab-utxo-ledger';
  const TX_KEY = 'chainlab-utxo-transactions';

  let utxos: Utxo[] = [];
  let transactions: TxRecord[] = [];
  let initAddress = '';
  let initAmount = 1;
  let recipients: { id: string; address: string; amount: number }[] = [];
  let selectedInputs = new Set<string>();
  let errorMessage = '';
  let lastFee = 0;
  let feeAmount = 0.0001;
  let changeAddress = '';
  let minerAddress = '';
  let selectedUtxos: Utxo[] = [];
  let previewRecipients: { id: string; address: string; amount: number }[] = [];
  let previewTotalInput = 0n;
  let previewRecipientTotal = 0n;
  let previewFee = 0n;
  let previewChange = 0n;
  let previewHasShortfall = false;
  const SATOSHIS_PER_BTC = 100_000_000n;

  const normalizeAmount = (value: number) => Number(value.toFixed(8));

  const toSats = (value: number) => {
    const scaled = Math.round(Number(value.toFixed(8)) * Number(SATOSHIS_PER_BTC));
    return BigInt(scaled);
  };

  const fromSats = (value: bigint) => Number(value) / Number(SATOSHIS_PER_BTC);

  const safeToSats = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return 0n;
    return toSats(value);
  };

  const formatBtc = (value: bigint) => `${normalizeAmount(fromSats(value))} BTC`;

  const shortAddress = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return 'empty address';
    if (trimmed.length <= 18) return trimmed;
    return `${trimmed.slice(0, 10)}…${trimmed.slice(-6)}`;
  };

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
    if (!Number.isFinite(initAmount) || initAmount <= 0) {
      errorMessage = 'Initial amount must be greater than zero.';
      return;
    }
    const newUtxo: Utxo = {
      id: crypto.randomUUID(),
      address: initAddress.trim(),
      amount: normalizeAmount(initAmount)
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
    if (recipients.length === 0) {
      errorMessage = 'Add at least one recipient.';
      return;
    }
    const invalidRecipient = recipients.find(
      (recipient) =>
        !recipient.address.trim() || !Number.isFinite(recipient.amount) || recipient.amount <= 0
    );
    if (invalidRecipient) {
      errorMessage = 'Each recipient needs an address and a positive amount.';
      return;
    }
    const inputs = utxos.filter((utxo) => selectedInputs.has(utxo.id));
    const totalInput = inputs.reduce((sum, utxo) => sum + toSats(utxo.amount), 0n);
    const totalOutput = recipients.reduce((sum, recipient) => sum + toSats(recipient.amount), 0n);
    const fee = toSats(feeAmount);
    if (fee < 0n) {
      errorMessage = 'Fee must be zero or greater.';
      return;
    }
    if (!changeAddress.trim()) {
      errorMessage = 'Enter a change address before sending.';
      return;
    }
    const totalRequired = totalOutput + fee;
    if (totalInput < totalRequired) {
      errorMessage = 'Selected inputs do not cover the recipient totals plus fee.';
      return;
    }

    const outputs: (Utxo & { purpose: 'recipient' | 'change' })[] = [];
    recipients.forEach((recipient) => {
      outputs.push({
        id: crypto.randomUUID(),
        address: recipient.address.trim(),
        amount: normalizeAmount(recipient.amount),
        purpose: 'recipient'
      });
    });
    const change = totalInput - totalRequired;
    if (change > 0n) {
      outputs.push({
        id: crypto.randomUUID(),
        address: changeAddress.trim(),
        amount: normalizeAmount(fromSats(change)),
        purpose: 'change'
      });
    }
    lastFee = normalizeAmount(fromSats(fee));

    const nextUtxos = utxos.filter((utxo) => !selectedInputs.has(utxo.id)).concat(outputs);
    const tx: TxRecord = {
      id: crypto.randomUUID(),
      inputs,
      outputs,
      timestamp: Date.now(),
      fee: normalizeAmount(fromSats(fee))
    };
    utxos = nextUtxos;
    transactions = [tx, ...transactions].slice(0, 5);
    selectedInputs = new Set();
    recipients = [{ id: crypto.randomUUID(), address: '', amount: 0 }];
    saveState(utxos, transactions);
  };

  const updateRecipientAddress = (index: number, event: Event) => {
    const target = event.currentTarget as HTMLInputElement | null;
    const value = target ? target.value : '';
    recipients = recipients.map((item, idx) =>
      idx === index ? { ...item, address: value } : item
    );
  };

  const updateRecipientAmount = (index: number, event: Event) => {
    const target = event.currentTarget as HTMLInputElement | null;
    const value = target ? Number(target.value) : 0;
    recipients = recipients.map((item, idx) =>
      idx === index ? { ...item, amount: value } : item
    );
  };

  const randomizeRecipient = (index: number) => {
    recipients = recipients.map((item, idx) =>
      idx === index ? { ...item, address: generateRandomAddress() } : item
    );
  };

  const removeRecipient = (id: string) => {
    if (recipients.length === 1) return;
    recipients = recipients.filter((item) => item.id !== id);
  };

  const addRecipient = () => {
    recipients = [
      ...recipients,
      { id: crypto.randomUUID(), address: generateRandomAddress(), amount: 0 }
    ];
  };

  const clearLedger = () => {
    utxos = [];
    transactions = [];
    selectedInputs = new Set();
    initAddress = '';
    changeAddress = '';
    minerAddress = '';
    recipients = [{ id: crypto.randomUUID(), address: '', amount: 0 }];
    errorMessage = '';
    lastFee = 0;
    feeAmount = 0.0001;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TX_KEY);
  };

  onMount(() => {
    loadState();
    initAddress = generateRandomAddress();
    changeAddress = initAddress;
    minerAddress = generateRandomAddress();
    recipients = [
      { id: crypto.randomUUID(), address: generateRandomAddress(), amount: 0.5 }
    ];
  });

  $: selectedUtxos = utxos.filter((utxo) => selectedInputs.has(utxo.id));
  $: previewRecipients = recipients.filter(
    (recipient) => recipient.address.trim() || safeToSats(recipient.amount) > 0n
  );
  $: previewTotalInput = selectedUtxos.reduce((sum, utxo) => sum + safeToSats(utxo.amount), 0n);
  $: previewRecipientTotal = previewRecipients.reduce(
    (sum, recipient) => sum + safeToSats(recipient.amount),
    0n
  );
  $: previewFee = safeToSats(feeAmount);
  $: previewChange =
    previewTotalInput > previewRecipientTotal + previewFee
      ? previewTotalInput - previewRecipientTotal - previewFee
      : 0n;
  $: previewHasShortfall = previewTotalInput < previewRecipientTotal + previewFee;
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
  <div class="recipient-list">
    {#each recipients as recipient, index (recipient.id)}
      <div class="recipient-row">
        <label>
          Recipient address
          <input
            type="text"
            placeholder="bc1q..."
            value={recipient.address}
            on:input={(event) => updateRecipientAddress(index, event)}
          />
        </label>
        <label>
          Amount (BTC)
          <input
            type="number"
            min="0"
            step="0.00000001"
            value={recipient.amount}
            on:input={(event) => updateRecipientAmount(index, event)}
          />
        </label>
        <div class="recipient-actions">
          <button
            class="secondary"
            on:click={() => randomizeRecipient(index)}
          >
            Random address
          </button>
          <button
            class="ghost"
            disabled={recipients.length === 1}
            on:click={() => removeRecipient(recipient.id)}
          >
            Remove
          </button>
        </div>
      </div>
    {/each}
  </div>
  <div class="button-row">
    <button
      class="secondary"
      on:click={addRecipient}
    >
      Add recipient
    </button>
    <button class="primary" on:click={sendTransaction} disabled={utxos.length === 0}>
      Send
    </button>
  </div>
  <div class="form-grid">
    <label>
      Fee (BTC)
      <input type="number" min="0" step="0.00000001" bind:value={feeAmount} />
    </label>
    <label>
      Change address
      <input type="text" bind:value={changeAddress} placeholder="bc1q..." />
    </label>
    <label>
      Simulated miner reward address
      <input type="text" bind:value={minerAddress} placeholder="bc1q..." />
    </label>
    <div class="button-row">
      <button class="secondary" on:click={() => (minerAddress = generateRandomAddress())}>
        Random miner address
      </button>
    </div>
  </div>
  <p class="subtle">
    Unspent value returns to the change address. Fee is collected by the block producer in a
    coinbase reward, not as a normal transaction output. Current fee: {lastFee} BTC
  </p>
  {#if errorMessage}
    <p class="error">{errorMessage}</p>
  {/if}
</section>

<section class="utxo-card">
  <div>
    <h3>UTXO flow preview</h3>
    <p class="subtle">
      The diagram turns your current form into the transaction shape: selected UTXOs are consumed,
      recipient and change outputs are created, and the fee is not a new UTXO.
    </p>
  </div>

  <div class="flow-diagram" class:shortfall={previewHasShortfall}>
    <div class="flow-lane">
      <h4>Selected inputs</h4>
      {#if selectedUtxos.length === 0}
        <div class="empty-node">Choose one or more UTXOs above.</div>
      {:else}
        {#each selectedUtxos as utxo}
          <div class="flow-node input-node">
            <span class="node-kicker">UTXO</span>
            <strong>{utxo.amount} BTC</strong>
            <span class="hash">{shortAddress(utxo.address)}</span>
          </div>
        {/each}
      {/if}
    </div>

    <div class="flow-center" aria-hidden="true">
      <div class="join-lines"></div>
      <div class="tx-node">
        <span>Transaction</span>
        <strong>{formatBtc(previewTotalInput)}</strong>
      </div>
      <div class="split-lines"></div>
    </div>

    <div class="flow-lane">
      <h4>Created outputs</h4>
      {#if previewRecipients.length === 0}
        <div class="empty-node">Add a recipient amount to see outputs.</div>
      {:else}
        {#each previewRecipients as recipient (recipient.id)}
          <div class="flow-node output-node">
            <span class="node-kicker">Recipient output</span>
            <strong>{recipient.amount || 0} BTC</strong>
            <span class="hash">{shortAddress(recipient.address)}</span>
          </div>
        {/each}
      {/if}

      {#if previewChange > 0n}
        <div class="flow-node change-node">
          <span class="node-kicker">Change output</span>
          <strong>{formatBtc(previewChange)}</strong>
          <span class="hash">{shortAddress(changeAddress)}</span>
        </div>
      {/if}

      <div class="flow-node fee-node">
        <span class="node-kicker">Block producer fee claim</span>
        <strong>{formatBtc(previewFee)}</strong>
        <span class="hash">{shortAddress(minerAddress)}</span>
        <span class="fee-note">Coinbase reward, not a normal output</span>
      </div>
    </div>
  </div>

  <div class="flow-summary">
    <span>Inputs: {formatBtc(previewTotalInput)}</span>
    <span>Recipients: {formatBtc(previewRecipientTotal)}</span>
    <span>Fee: {formatBtc(previewFee)}</span>
    <span>Change: {formatBtc(previewChange)}</span>
  </div>
  {#if previewHasShortfall}
    <p class="error">Preview shortfall: selected inputs do not cover outputs plus fee.</p>
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
              <span class="hash">
                {output.purpose === 'change' ? `Change → ${output.address}` : output.address}
              </span>
              <strong>{output.amount} BTC</strong>
            </div>
          {/each}
          <p class="subtle">Fee: {tx.fee} BTC</p>
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

  .recipient-list {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .recipient-row {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(140px, 0.6fr) auto;
    gap: 0.75rem;
    align-items: flex-end;
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 0.9rem;
    background: var(--background);
  }

  .recipient-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
  }

  .recipient-actions button {
    border-radius: 999px;
    border: 1px solid transparent;
    padding: 0.55rem 1rem;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
    cursor: pointer;
  }

  .recipient-actions button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
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

  .flow-diagram {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 140px minmax(0, 1fr);
    gap: 1rem;
    align-items: center;
    border: 1px solid var(--border);
    border-radius: 18px;
    padding: 1rem;
    background:
      radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0.06), transparent 32%),
      var(--background);
  }

  .flow-diagram.shortfall {
    border-color: #b00020;
  }

  .flow-lane {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .flow-lane h4 {
    margin: 0;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted-text);
  }

  .flow-center {
    min-height: 230px;
    display: grid;
    grid-template-rows: 1fr auto 1fr;
    align-items: center;
    justify-items: center;
  }

  .join-lines,
  .split-lines {
    width: 2px;
    height: 100%;
    background: linear-gradient(var(--border), var(--text), var(--border));
    opacity: 0.45;
  }

  .tx-node {
    width: 130px;
    min-height: 130px;
    border: 2px solid var(--text);
    border-radius: 50%;
    background: var(--surface);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    text-align: center;
    box-shadow: var(--shadow);
  }

  .tx-node span,
  .node-kicker {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted-text);
  }

  .tx-node strong {
    font-size: 0.9rem;
  }

  .flow-node,
  .empty-node {
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 0.8rem;
    background: var(--surface);
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    position: relative;
    overflow: hidden;
  }

  .flow-node::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 5px;
  }

  .input-node::before {
    background: #2563eb;
  }

  .output-node::before {
    background: #16a34a;
  }

  .change-node::before {
    background: #d97706;
  }

  .fee-node::before {
    background: #6b7280;
  }

  .empty-node {
    color: var(--muted-text);
    border-style: dashed;
    background: transparent;
  }

  .flow-summary {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  .flow-summary span {
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0.35rem 0.75rem;
    background: var(--background);
    font-size: 0.82rem;
    color: var(--muted-text);
  }

  .fee-note {
    font-size: 0.72rem;
    color: var(--muted-text);
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
    .recipient-row {
      grid-template-columns: 1fr;
      align-items: stretch;
    }

    .recipient-actions {
      justify-content: flex-start;
    }

    .flow-diagram {
      grid-template-columns: 1fr;
    }

    .flow-center {
      min-height: auto;
      grid-template-rows: auto;
    }

    .join-lines,
    .split-lines {
      width: 100%;
      height: 2px;
    }

    .tx {
      grid-template-columns: 1fr;
      text-align: center;
    }
  }
</style>
