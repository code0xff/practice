<script lang="ts">
  import { onMount } from 'svelte';

  type Utxo = {
    id: string;
    address: string;
    amount: number;
  };

  type ScriptStep = {
    id: string;
    label: string;
    description: string;
    action: (stack: string[]) => string[];
  };

  const createRandomHex = (length: number) => {
    const bytes = new Uint8Array(length / 2);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  };

  const generateAddress = () => `bc1q${createRandomHex(20)}`;
  const generatePublicKey = () => `02${createRandomHex(64)}`;
  const generateSignature = () => `3045${createRandomHex(60)}`;

  const shortHash = (value: string) => {
    let hash = 0;
    for (const char of value) {
      hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  };

  const isErrorStatus = (status: 'idle' | 'running' | 'complete' | 'error') =>
    status === 'error';

  let initAddress = '';
  let initAmount = 1;
  let utxo: Utxo | null = null;
  let recipientAddress = '';
  let recipientAmount = 0.5;
  let signature = '';
  let publicKey = '';
  let pubKeyHash = '';
  let stack: string[] = [];
  let scriptSteps: ScriptStep[] = [];
  let currentStepIndex = -1;
  let scriptStatus: 'idle' | 'running' | 'complete' | 'error' = 'idle';
  let message = '';
  let newUtxo: Utxo | null = null;

  const formatStackItem = (item: string) => {
    if (item.startsWith('SIG:')) {
      return `SIG(${item.slice(4, 16)}...)`;
    }
    if (item.startsWith('PUBKEY:')) {
      return `PUBKEY(${item.slice(7, 19)}...)`;
    }
    return item;
  };

  const initializeUtxo = () => {
    if (!initAddress.trim() || initAmount <= 0) {
      message = 'Enter a wallet address and an initial amount to create the UTXO.';
      return;
    }
    utxo = {
      id: `UTXO-${createRandomHex(8)}`,
      address: initAddress.trim(),
      amount: Number(initAmount.toFixed(8))
    };
    recipientAmount = utxo.amount;
    message = 'A new UTXO was created. Enter transfer details next.';
    scriptStatus = 'idle';
    stack = [];
    currentStepIndex = -1;
    newUtxo = null;
  };

  const buildSteps = () => {
    if (!utxo) return [];

    return [
      {
        id: 'push-sig',
        label: 'Push Signature',
        description: 'Push the signature from scriptSig onto the stack.',
        action: (nextStack) => [...nextStack, `SIG:${signature}`]
      },
      {
        id: 'push-pubkey',
        label: 'Push Public Key',
        description: 'Push the public key from scriptSig onto the stack.',
        action: (nextStack) => [...nextStack, `PUBKEY:${publicKey}`]
      },
      {
        id: 'op-dup',
        label: 'OP_DUP',
        description: 'Duplicate the top stack item (the public key).',
        action: (nextStack) => {
          if (nextStack.length === 0) return nextStack;
          return [...nextStack, nextStack[nextStack.length - 1]];
        }
      },
      {
        id: 'op-hash160',
        label: 'OP_HASH160',
        description: 'Hash the duplicated public key to create PUBKEY_HASH.',
        action: (nextStack) => {
          if (nextStack.length === 0) return nextStack;
          const last = nextStack[nextStack.length - 1];
          const rawKey = last.startsWith('PUBKEY:') ? last.slice(7) : last;
          const hashed = `HASH160(${shortHash(rawKey)})`;
          return [...nextStack.slice(0, -1), hashed];
        }
      },
      {
        id: 'push-hash',
        label: 'Push PubKeyHash',
        description: 'Push the expected pubkey hash from the locking script.',
        action: (nextStack) => [...nextStack, `LOCK_HASH(${pubKeyHash})`]
      },
      {
        id: 'op-equalverify',
        label: 'OP_EQUALVERIFY',
        description: 'Verify the hashes match or fail the script immediately.',
        action: (nextStack) => {
          if (nextStack.length < 2) return nextStack;
          const expected = nextStack[nextStack.length - 1];
          const actual = nextStack[nextStack.length - 2];
          const expectedHash = expected.match(/LOCK_HASH\((.+)\)/)?.[1];
          const actualHash = actual.match(/HASH160\((.+)\)/)?.[1];
          if (!expectedHash || !actualHash || expectedHash !== actualHash) {
            scriptStatus = 'error';
            message = 'The hash check failed, so the script did not validate.';
          }
          return nextStack.slice(0, -2);
        }
      },
      {
        id: 'op-checksig',
        label: 'OP_CHECKSIG',
        description: 'Validate the signature against the public key.',
        action: (nextStack) => {
          if (nextStack.length < 2) return nextStack;
          return [...nextStack.slice(0, -2), 'TRUE'];
        }
      },
      {
        id: 'finalize',
        label: 'Finalize',
        description: 'Consume the input UTXO and produce the recipient output.',
        action: (nextStack) => {
          const outputAmount = utxo ? utxo.amount : recipientAmount;
          newUtxo = {
            id: `UTXO-${createRandomHex(8)}`,
            address: recipientAddress.trim(),
            amount: Number(outputAmount.toFixed(8))
          };
          return nextStack;
        }
      }
    ];
  };

  const startScript = () => {
    if (!utxo) {
      message = 'Create an initial UTXO before starting the script.';
      return;
    }
    if (!recipientAddress.trim()) {
      message = 'Enter a recipient address to continue.';
      return;
    }
    recipientAmount = utxo.amount;
    signature = generateSignature();
    publicKey = generatePublicKey();
    pubKeyHash = shortHash(publicKey);
    stack = [];
    currentStepIndex = -1;
    scriptSteps = buildSteps();
    scriptStatus = 'running';
    message = 'Script execution started. Use Next to step through each opcode.';
  };

  const nextStep = () => {
    if (scriptStatus !== 'running') return;
    if (currentStepIndex >= scriptSteps.length - 1) {
      scriptStatus = 'complete';
      message = 'All script steps are complete.';
      return;
    }
    const nextIndex = currentStepIndex + 1;
    const step = scriptSteps[nextIndex];
    stack = step.action([...stack]);
    currentStepIndex = nextIndex;
    if (isErrorStatus(scriptStatus)) {
      return;
    }
    if (nextIndex === scriptSteps.length - 1) {
      scriptStatus = 'complete';
      message = 'All script steps are complete.';
    }
  };

  const resetScript = () => {
    stack = [];
    currentStepIndex = -1;
    scriptStatus = 'idle';
    message = 'Adjust the transfer details and run a new simulation.';
    newUtxo = null;
  };

  onMount(() => {
    initAddress = generateAddress();
    recipientAddress = generateAddress();
  });
</script>

<section class="utxo-script">
  <div class="header">
    <div>
      <h3>UTXO Script Execution Simulator</h3>
      <p class="subtle">
        Create an initial UTXO, enter transfer details, and step through the stack-based
        script execution.
      </p>
    </div>
  </div>

  <div class="panel">
    <div>
      <h4>1. Initialize a UTXO</h4>
      <div class="form-grid">
        <label>
          Wallet address
          <input type="text" bind:value={initAddress} placeholder="bc1q..." />
        </label>
        <label>
          Initial amount (BTC)
          <input type="number" min="0" step="0.00000001" bind:value={initAmount} />
        </label>
      </div>
      <div class="button-row">
        <button class="secondary" on:click={() => (initAddress = generateAddress())}>
          Generate address
        </button>
        <button class="primary" on:click={initializeUtxo}>Create UTXO</button>
      </div>
    </div>

    <div>
      <h4>2. Enter transfer request</h4>
      <div class="form-grid">
        <label>
          Recipient address
          <input type="text" bind:value={recipientAddress} placeholder="bc1q..." />
        </label>
        <label>
          Transfer amount (BTC)
          <input
            type="number"
            min="0"
            step="0.00000001"
            value={recipientAmount}
            disabled
          />
          <span class="helper">Locked to the input UTXO amount.</span>
        </label>
      </div>
      <div class="button-row">
        <button class="secondary" on:click={() => (recipientAddress = generateAddress())}>
          Generate address
        </button>
        <button class="primary" on:click={startScript}>Send + Start</button>
      </div>
    </div>
  </div>

  <div class="panel status">
    <div>
      <h4>Current UTXO</h4>
      {#if utxo}
        <div class="pill">
          <strong>{utxo.id}</strong>
          <span>{utxo.address}</span>
          <span>{utxo.amount} BTC</span>
        </div>
      {:else}
        <p class="subtle">No UTXO yet. Create one above to continue.</p>
      {/if}
    </div>
    <div>
      <h4>New UTXO</h4>
      {#if newUtxo}
        <div class="pill highlight">
          <strong>{newUtxo.id}</strong>
          <span>{newUtxo.address}</span>
          <span>{newUtxo.amount} BTC</span>
        </div>
      {:else}
        <p class="subtle">The recipient UTXO appears after the script finishes.</p>
      {/if}
    </div>
  </div>

  <div class="panel steps">
    <div class="step-list">
      <h4>Script steps</h4>
      <ol>
        {#each scriptSteps as step, index}
          <li class:active={index === currentStepIndex} class:done={index < currentStepIndex}>
            <strong>{step.label}</strong>
            <span>{step.description}</span>
          </li>
        {/each}
      </ol>
      <div class="button-row">
        <button
          class="primary"
          on:click={nextStep}
          disabled={scriptStatus !== 'running' || currentStepIndex >= scriptSteps.length - 1}
        >
          Next
        </button>
        <button class="secondary" on:click={resetScript} disabled={scriptStatus === 'running'}>
          Reset
        </button>
      </div>
    </div>
    <div class="stack-view">
      <h4>Stack state</h4>
      <div class="stack">
        {#if stack.length === 0}
          <p class="subtle">The stack is empty until you start stepping through the script.</p>
        {:else}
          {#each [...stack].reverse() as item}
            <div class="stack-item">{formatStackItem(item)}</div>
          {/each}
        {/if}
      </div>
      <div class="script-meta">
        <p class:warning={scriptStatus === 'error'}>{message}</p>
        {#if signature}
          <div class="meta-sections">
            <div class="meta-card">
              <h5>UTXO → Script (locking data)</h5>
              <div class="meta-grid">
                <div>
                  <span>PubKey Hash</span>
                  <strong>{pubKeyHash}</strong>
                </div>
                <div>
                  <span>Input amount</span>
                  <strong>{utxo ? `${utxo.amount} BTC` : '--'}</strong>
                </div>
              </div>
            </div>
            <div class="meta-card">
              <h5>Transaction → Script (user data)</h5>
              <div class="meta-grid">
                <div>
                  <span>Signature</span>
                  <strong>{signature.slice(0, 24)}...</strong>
                </div>
                <div>
                  <span>Public Key</span>
                  <strong>{publicKey.slice(0, 24)}...</strong>
                </div>
                <div>
                  <span>Recipient</span>
                  <strong>{recipientAddress.slice(0, 18)}...</strong>
                </div>
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</section>

<style>
  .utxo-script {
    margin-top: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: flex-start;
  }

  .panel {
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 1.5rem;
    background: var(--surface);
    box-shadow: var(--shadow);
    display: grid;
    gap: 1.5rem;
  }

  .panel.status {
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  }

  .panel.steps {
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    align-items: start;
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
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  button {
    border-radius: 999px;
    padding: 0.55rem 1.4rem;
    font-weight: 600;
    border: 1px solid transparent;
    cursor: pointer;
  }

  button:disabled {
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

  .pill {
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 0.75rem;
    background: var(--background);
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.85rem;
  }

  .pill span {
    color: var(--muted-text);
    word-break: break-all;
  }

  .pill.highlight {
    border-color: var(--primary);
  }

  .step-list ol {
    margin: 0;
    padding-left: 1.2rem;
    display: grid;
    gap: 0.75rem;
  }

  .step-list li {
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 0.75rem;
    background: var(--background);
    display: grid;
    gap: 0.35rem;
  }

  .step-list li.active {
    border-color: var(--primary);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 20%, transparent);
  }

  .step-list li.done {
    opacity: 0.7;
  }

  .step-list li span {
    color: var(--muted-text);
    font-size: 0.85rem;
  }

  .stack {
    border: 1px dashed var(--border);
    border-radius: 12px;
    padding: 1rem;
    min-height: 160px;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: var(--background);
  }

  .stack-item {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.5rem 0.75rem;
    background: var(--surface);
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 0.75rem;
    word-break: break-all;
  }

  .script-meta {
    margin-top: 1rem;
    display: grid;
    gap: 0.75rem;
  }

  .script-meta p {
    margin: 0;
    font-weight: 600;
  }

  .script-meta p.warning {
    color: #b00020;
  }

  .helper {
    font-size: 0.75rem;
    color: var(--muted-text);
  }

  .meta-sections {
    display: grid;
    gap: 0.75rem;
  }

  .meta-card {
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 0.75rem;
    background: var(--background);
    display: grid;
    gap: 0.65rem;
  }

  .meta-card h5 {
    margin: 0;
    font-size: 0.85rem;
  }

  .meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.75rem;
  }

  .meta-grid span {
    display: block;
    font-size: 0.75rem;
    color: var(--muted-text);
  }

  @media (max-width: 720px) {
    .panel,
    .panel.steps,
    .panel.status {
      grid-template-columns: 1fr;
    }
  }
</style>
