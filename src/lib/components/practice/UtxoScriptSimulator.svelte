<script lang="ts">
  import { onMount } from 'svelte';
  import { getPublicKey, signAsync, utils, verifyAsync } from '@noble/secp256k1';

  type Utxo = {
    id: string;
    address: string;
    amount: number;
    ownerPrivateKey: string;
    ownerPublicKey: string;
    ownerPubKeyHash: string;
  };

  type SpendResultUtxo = {
    id: string;
    address: string;
    amount: number;
  };

  type ScriptStep = {
    id: string;
    label: string;
    description: string;
    action: (stack: string[]) => Promise<string[]> | string[];
  };

  const createRandomHex = (length: number) => {
    const bytes = new Uint8Array(length / 2);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  };

  const generateAddress = () => `bc1q${createRandomHex(20)}`;
  const toHex = (bytes: Uint8Array) =>
    Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');

  const fromHex = (value: string) => {
    const normalized = value.trim().replace(/^0x/i, '').toLowerCase();
    if (!normalized) return new Uint8Array();
    if (!/^[0-9a-f]+$/.test(normalized) || normalized.length % 2 !== 0) {
      throw new Error('Hex value is invalid.');
    }
    return Uint8Array.from(normalized.match(/.{1,2}/g) ?? [], (byte) => Number(`0x${byte}`));
  };

  const concatBytes = (left: Uint8Array, right: Uint8Array) => {
    const out = new Uint8Array(left.length + right.length);
    out.set(left, 0);
    out.set(right, left.length);
    return out;
  };

  const rol = (x: number, n: number) => ((x << n) | (x >>> (32 - n))) >>> 0;

  const ripemd160 = (input: Uint8Array): Uint8Array => {
    const r1 = [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 7, 4, 13, 1, 10, 6, 15, 3, 12, 0,
      9, 5, 2, 14, 11, 8, 3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12, 1, 9, 11, 10,
      0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2, 4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15,
      13
    ];
    const r2 = [
      5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12, 6, 11, 3, 7, 0, 13, 5, 10, 14, 15,
      8, 12, 4, 9, 1, 2, 15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13, 8, 6, 4, 1, 3,
      11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14, 12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9,
      11
    ];
    const s1 = [
      11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8, 7, 6, 8, 13, 11, 9, 7, 15, 7, 12,
      15, 9, 11, 7, 13, 12, 11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5, 11, 12, 14,
      15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12, 9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11,
      8, 5, 6
    ];
    const s2 = [
      8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6, 9, 13, 15, 7, 12, 8, 9, 11, 7, 7,
      12, 7, 6, 15, 13, 11, 9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5, 15, 5, 8,
      11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8, 8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15,
      13, 11, 11
    ];

    const f = (j: number, x: number, y: number, z: number) => {
      if (j <= 15) return x ^ y ^ z;
      if (j <= 31) return (x & y) | (~x & z);
      if (j <= 47) return (x | ~y) ^ z;
      if (j <= 63) return (x & z) | (y & ~z);
      return x ^ (y | ~z);
    };

    const K1 = (j: number) =>
      j <= 15 ? 0x00000000 : j <= 31 ? 0x5a827999 : j <= 47 ? 0x6ed9eba1 : j <= 63 ? 0x8f1bbcdc : 0xa953fd4e;
    const K2 = (j: number) =>
      j <= 15 ? 0x50a28be6 : j <= 31 ? 0x5c4dd124 : j <= 47 ? 0x6d703ef3 : j <= 63 ? 0x7a6d76e9 : 0x00000000;

    const bitLen = input.length * 8;
    const padLen = ((56 - ((input.length + 1) % 64)) + 64) % 64;
    const padded = new Uint8Array(input.length + 1 + padLen + 8);
    padded.set(input);
    padded[input.length] = 0x80;
    for (let i = 0; i < 8; i += 1) {
      padded[padded.length - 8 + i] = (bitLen >>> (8 * i)) & 0xff;
    }

    let h0 = 0x67452301;
    let h1 = 0xefcdab89;
    let h2 = 0x98badcfe;
    let h3 = 0x10325476;
    let h4 = 0xc3d2e1f0;

    const x = new Uint32Array(16);
    for (let i = 0; i < padded.length; i += 64) {
      for (let j = 0; j < 16; j += 1) {
        const k = i + j * 4;
        x[j] = (padded[k] | (padded[k + 1] << 8) | (padded[k + 2] << 16) | (padded[k + 3] << 24)) >>> 0;
      }

      let al = h0;
      let bl = h1;
      let cl = h2;
      let dl = h3;
      let el = h4;
      let ar = h0;
      let br = h1;
      let cr = h2;
      let dr = h3;
      let er = h4;

      for (let j = 0; j < 80; j += 1) {
        const tl = rol((al + f(j, bl, cl, dl) + x[r1[j]] + K1(j)) >>> 0, s1[j]);
        const tl2 = (tl + el) >>> 0;
        al = el;
        el = dl;
        dl = rol(cl, 10);
        cl = bl;
        bl = tl2;

        const tr = rol((ar + f(79 - j, br, cr, dr) + x[r2[j]] + K2(j)) >>> 0, s2[j]);
        const tr2 = (tr + er) >>> 0;
        ar = er;
        er = dr;
        dr = rol(cr, 10);
        cr = br;
        br = tr2;
      }

      const t = (h1 + cl + dr) >>> 0;
      h1 = (h2 + dl + er) >>> 0;
      h2 = (h3 + el + ar) >>> 0;
      h3 = (h4 + al + br) >>> 0;
      h4 = (h0 + bl + cr) >>> 0;
      h0 = t;
    }

    const out = new Uint8Array(20);
    const words = [h0, h1, h2, h3, h4];
    for (let i = 0; i < words.length; i += 1) {
      const word = words[i];
      out[i * 4] = word & 0xff;
      out[i * 4 + 1] = (word >>> 8) & 0xff;
      out[i * 4 + 2] = (word >>> 16) & 0xff;
      out[i * 4 + 3] = (word >>> 24) & 0xff;
    }
    return out;
  };

  const sha256 = async (input: Uint8Array) => {
    const digest = await crypto.subtle.digest('SHA-256', input as unknown as BufferSource);
    return new Uint8Array(digest);
  };

  const hash160Hex = async (input: Uint8Array) => toHex(ripemd160(await sha256(input)));

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
  let unlockingPublicKey = '';
  let lockingPubKeyHash = '';
  let stack: string[] = [];
  let scriptSteps: ScriptStep[] = [];
  let currentStepIndex = -1;
  let scriptStatus: 'idle' | 'running' | 'complete' | 'error' = 'idle';
  let message = '';
  let newUtxo: SpendResultUtxo | null = null;
  let signingPrivateKey = '';
  let signingMessageHash = '';

  const formatStackItem = (item: string) => {
    if (item.startsWith('SIG:')) {
      return `SIG(${item.slice(4, 16)}...)`;
    }
    if (item.startsWith('PUBKEY:')) {
      return `PUBKEY(${item.slice(7, 19)}...)`;
    }
    return item;
  };

  const initializeUtxo = async () => {
    if (!initAddress.trim() || initAmount <= 0) {
      message = 'Enter a wallet address and an initial amount to create the UTXO.';
      return;
    }
    try {
      const ownerPrivateKey = toHex(utils.randomSecretKey());
      const ownerPublicKey = toHex(getPublicKey(fromHex(ownerPrivateKey), true));
      const ownerPubKeyHash = await hash160Hex(fromHex(ownerPublicKey));
      utxo = {
        id: `UTXO-${createRandomHex(8)}`,
        address: initAddress.trim(),
        amount: Number(initAmount.toFixed(8)),
        ownerPrivateKey,
        ownerPublicKey,
        ownerPubKeyHash
      };
      recipientAmount = Number(initAmount.toFixed(8));
      message = 'A new UTXO was created with a locking pubkey hash. Enter transfer details next.';
      scriptStatus = 'idle';
      stack = [];
      currentStepIndex = -1;
      newUtxo = null;
    } catch (error) {
      message = error instanceof Error ? error.message : 'Failed to create owner key material.';
    }
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
        action: (nextStack) => [...nextStack, `PUBKEY:${unlockingPublicKey}`]
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
        action: async (nextStack) => {
          if (nextStack.length === 0) return nextStack;
          const last = nextStack[nextStack.length - 1];
          const rawKey = last.startsWith('PUBKEY:') ? last.slice(7) : last;
          const hashed = `HASH160(${await hash160Hex(fromHex(rawKey))})`;
          return [...nextStack.slice(0, -1), hashed];
        }
      },
      {
        id: 'push-hash',
        label: 'Push PubKeyHash',
        description: 'Push the expected pubkey hash from the locking script.',
        action: (nextStack) => [...nextStack, `LOCK_HASH(${lockingPubKeyHash})`]
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
        action: async (nextStack) => {
          if (nextStack.length < 2) return nextStack;
          const sigRaw = nextStack[nextStack.length - 2];
          const pubRaw = nextStack[nextStack.length - 1];
          const sig = sigRaw.startsWith('SIG:') ? sigRaw.slice(4) : sigRaw;
          const pub = pubRaw.startsWith('PUBKEY:') ? pubRaw.slice(7) : pubRaw;
          let valid = false;
          try {
            valid = await verifyAsync(fromHex(sig), fromHex(signingMessageHash), fromHex(pub), {
              lowS: true,
              prehash: false
            });
          } catch {
            valid = false;
          }
          if (!valid) {
            scriptStatus = 'error';
            message = 'Signature verification failed (OP_CHECKSIG=false).';
          }
          return [...nextStack.slice(0, -2), valid ? 'TRUE' : 'FALSE'];
        }
      },
      {
        id: 'finalize',
        label: 'Finalize',
        description: 'Consume the input UTXO and produce the recipient output.',
        action: (nextStack) => {
          if (nextStack[nextStack.length - 1] !== 'TRUE') {
            scriptStatus = 'error';
            message = 'Finalization blocked because script result is not TRUE.';
            return nextStack;
          }
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

  const startScript = async () => {
    if (!utxo) {
      message = 'Create an initial UTXO before starting the script.';
      return;
    }
    if (!recipientAddress.trim()) {
      message = 'Enter a recipient address to continue.';
      return;
    }
    try {
      recipientAmount = utxo.amount;
      recipientAmount = utxo.amount;
      signingPrivateKey = utxo.ownerPrivateKey;
      unlockingPublicKey = utxo.ownerPublicKey;
      lockingPubKeyHash = utxo.ownerPubKeyHash;

      const msgSeed = new TextEncoder().encode(
        `${utxo.id}|${utxo.address}|${recipientAddress.trim()}|${recipientAmount}`
      );
      signingMessageHash = toHex(await sha256(msgSeed));
      signature = toHex(await signAsync(fromHex(signingMessageHash), fromHex(signingPrivateKey), {
        prehash: false,
        lowS: true
      }));

      stack = [];
      currentStepIndex = -1;
      scriptSteps = buildSteps();
      scriptStatus = 'running';
      message = 'Script execution started. Use Next to step through each opcode.';
    } catch (error) {
      scriptStatus = 'error';
      message = error instanceof Error ? error.message : 'Failed to prepare script execution.';
    }
  };

  const nextStep = async () => {
    if (scriptStatus !== 'running') return;
    if (currentStepIndex >= scriptSteps.length - 1) {
      scriptStatus = 'complete';
      message = 'All script steps are complete.';
      return;
    }
    const nextIndex = currentStepIndex + 1;
    const step = scriptSteps[nextIndex];
    stack = await step.action([...stack]);
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

  <div class="panel script-flow">
    <h4>Script validation visualization</h4>
    <div class="script-visual">
      <div class="script-node">
        <span>scriptSig</span>
        <strong>{signature ? 'signature + public key' : 'waiting for spend'}</strong>
      </div>
      <div class="script-arrow">+</div>
      <div class="script-node lock">
        <span>scriptPubKey</span>
        <strong>DUP HASH160 EQUALVERIFY CHECKSIG</strong>
      </div>
      <div class="script-arrow">→</div>
      <div class="script-node" class:success={scriptStatus === 'complete'} class:fail={scriptStatus === 'error'}>
        <span>Stack result</span>
        <strong>{scriptStatus === 'complete' ? 'valid spend' : scriptStatus === 'error' ? 'rejected' : 'not finalized'}</strong>
      </div>
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
                  <strong>{lockingPubKeyHash}</strong>
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
                  <strong>{unlockingPublicKey.slice(0, 24)}...</strong>
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

  .script-visual {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1.2fr) auto minmax(0, 1fr);
    gap: 0.75rem;
    align-items: stretch;
  }

  .script-node {
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 0.85rem;
    background: var(--background);
    display: grid;
    gap: 0.35rem;
  }

  .script-node.lock {
    border-color: #2563eb;
  }

  .script-node.success {
    border-color: #16a34a;
    box-shadow: inset 0 0 0 1px #16a34a;
  }

  .script-node.fail {
    border-color: #b00020;
  }

  .script-node span {
    color: var(--muted-text);
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .script-arrow {
    display: grid;
    place-items: center;
    color: var(--muted-text);
  }

  @media (max-width: 720px) {
    .panel,
    .panel.steps,
    .panel.status {
      grid-template-columns: 1fr;
    }

    .script-visual {
      grid-template-columns: 1fr;
    }

    .script-arrow {
      transform: rotate(90deg);
    }
  }
</style>
