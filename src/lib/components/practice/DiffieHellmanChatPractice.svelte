<script lang="ts">
  import { onMount } from 'svelte';
  import { getSharedSecret, getPublicKey, utils } from '@noble/secp256k1';

  type Party = {
    name: string;
    privateKey: string;
    publicKey: string;
    partnerPublicKey: string;
    sharedSecret: string;
    message: string;
    encrypted: string;
    decrypted: string;
    error: string;
  };

  const createParty = (name: string): Party => ({
    name,
    privateKey: '',
    publicKey: '',
    partnerPublicKey: '',
    sharedSecret: '',
    message: '',
    encrypted: '',
    decrypted: '',
    error: ''
  });

  let alice = createParty('Alice');
  let bob = createParty('Bob');
  let ceremonyStep = 'Generate keys, exchange public keys, then derive the shared secret.';

  const shortValue = (value: string) => {
    if (!value) return '—';
    if (value.length <= 16) return value;
    return `${value.slice(0, 8)}…${value.slice(-6)}`;
  };

  const toHex = (buffer: ArrayBuffer | Uint8Array) => {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    return Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  };

  const fromHex = (value: string) => {
    const normalized = value.trim().replace(/^0x/, '');
    if (!normalized || normalized.length % 2 !== 0) {
      throw new Error('Hex string must have an even length.');
    }
    return Uint8Array.from(normalized.match(/.{1,2}/g) ?? [], (byte) => Number(`0x${byte}`));
  };

  const sha256Hex = async (value: string) => {
    const encoded = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return toHex(digest);
  };

  const deriveAesKey = async (sharedSecret: string) => {
    const hashed = await sha256Hex(sharedSecret);
    const keyData = Uint8Array.from(hashed.match(/.{1,2}/g) ?? [], (byte) => Number(`0x${byte}`));
    return crypto.subtle.importKey('raw', keyData, 'AES-GCM', false, ['encrypt', 'decrypt']);
  };

  const generateKeys = (party: Party) => {
    try {
      party.error = '';
      const priv = toHex(utils.randomSecretKey());
      const pub = toHex(getPublicKey(priv, true));
      party.privateKey = priv;
      party.publicKey = pub;
      party.sharedSecret = '';
      party.encrypted = '';
      party.decrypted = '';
    } catch (error) {
      party.error = error instanceof Error ? error.message : 'Failed to generate keys.';
    }
  };

  const updatePublicKey = (party: Party) => {
    try {
      party.error = '';
      if (!party.privateKey) {
        party.error = 'Enter a private key first.';
        return;
      }
      party.publicKey = toHex(getPublicKey(party.privateKey, true));
      party.sharedSecret = '';
      party.encrypted = '';
      party.decrypted = '';
    } catch (error) {
      party.error = error instanceof Error ? error.message : 'Invalid private key.';
    }
  };

  const deriveSharedSecret = (party: Party) => {
    try {
      party.error = '';
      if (!party.privateKey || !party.partnerPublicKey) {
        party.error = 'Provide your private key and the partner public key.';
        return;
      }
      const secret = getSharedSecret(
        fromHex(party.privateKey),
        fromHex(party.partnerPublicKey),
        true
      );
      party.sharedSecret = toHex(secret);
      ceremonyStep = 'Shared secret derived. You can now encrypt and decrypt messages.';
    } catch (error) {
      party.error = error instanceof Error ? error.message : 'Unable to derive shared secret.';
    }
  };

  const encryptMessage = async (sender: Party) => {
    sender.error = '';
    if (!sender.sharedSecret) {
      sender.error = 'Derive the shared secret first.';
      return;
    }
    if (!sender.message.trim()) {
      sender.error = 'Enter a message to encrypt.';
      return;
    }
    const key = await deriveAesKey(sender.sharedSecret);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(sender.message);
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    const combined = new Uint8Array(iv.byteLength + cipher.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cipher), iv.byteLength);
    sender.encrypted = btoa(String.fromCharCode(...combined));
  };

  const decryptMessage = async (receiver: Party, payload: string) => {
    receiver.error = '';
    if (!receiver.sharedSecret) {
      receiver.error = 'Derive the shared secret first.';
      return;
    }
    if (!payload) {
      receiver.error = 'No encrypted payload to decrypt.';
      return;
    }
    const data = Uint8Array.from(atob(payload), (char) => char.charCodeAt(0));
    const iv = data.slice(0, 12);
    const cipher = data.slice(12);
    const key = await deriveAesKey(receiver.sharedSecret);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    receiver.decrypted = new TextDecoder().decode(plain);
  };

  const syncPublicKeys = () => {
    alice.partnerPublicKey = bob.publicKey;
    bob.partnerPublicKey = alice.publicKey;
  };

  onMount(() => {
    generateKeys(alice);
    generateKeys(bob);
    syncPublicKeys();
  });

  $: if (alice.publicKey && bob.publicKey) {
    syncPublicKeys();
  }
</script>

<section class="dh-card ceremony-card">
  <h3>Diffie-Hellman ceremony</h3>
  <p class="subtle">{ceremonyStep}</p>
</section>

<section class="dh-grid">
  <div class="dh-card">
    <div class="header">
      <h3>{alice.name}</h3>
      <button class="ghost" on:click={() => generateKeys(alice)}>Generate keys</button>
    </div>
    <label>
      Private key
      <input type="text" bind:value={alice.privateKey} on:blur={() => updatePublicKey(alice)} />
    </label>
    <label>
      Public key
      <input type="text" bind:value={alice.publicKey} readonly />
    </label>
    <label>
      Partner public key
      <input type="text" bind:value={alice.partnerPublicKey} />
    </label>
    <div class="row">
      <button class="secondary" on:click={() => deriveSharedSecret(alice)}>Derive secret</button>
      <span class="hash" title={alice.sharedSecret}>{shortValue(alice.sharedSecret)}</span>
    </div>
    <label>
      Message to send
      <textarea rows="3" bind:value={alice.message} placeholder="Type a message for Bob"></textarea>
    </label>
    <button class="primary" on:click={() => encryptMessage(alice)}>Encrypt with secret</button>
    <label>
      Encrypted payload
      <textarea rows="3" bind:value={alice.encrypted} readonly></textarea>
    </label>
    <button class="secondary" on:click={() => decryptMessage(alice, bob.encrypted)}>
      Decrypt Bob's message
    </button>
    <label>
      Decrypted message
      <textarea rows="3" bind:value={alice.decrypted} readonly></textarea>
    </label>
    {#if alice.error}
      <p class="error">{alice.error}</p>
    {/if}
  </div>

  <div class="dh-card">
    <div class="header">
      <h3>{bob.name}</h3>
      <button class="ghost" on:click={() => generateKeys(bob)}>Generate keys</button>
    </div>
    <label>
      Private key
      <input type="text" bind:value={bob.privateKey} on:blur={() => updatePublicKey(bob)} />
    </label>
    <label>
      Public key
      <input type="text" bind:value={bob.publicKey} readonly />
    </label>
    <label>
      Partner public key
      <input type="text" bind:value={bob.partnerPublicKey} />
    </label>
    <div class="row">
      <button class="secondary" on:click={() => deriveSharedSecret(bob)}>Derive secret</button>
      <span class="hash" title={bob.sharedSecret}>{shortValue(bob.sharedSecret)}</span>
    </div>
    <label>
      Message to send
      <textarea rows="3" bind:value={bob.message} placeholder="Type a message for Alice"></textarea>
    </label>
    <button class="primary" on:click={() => encryptMessage(bob)}>Encrypt with secret</button>
    <label>
      Encrypted payload
      <textarea rows="3" bind:value={bob.encrypted} readonly></textarea>
    </label>
    <button class="secondary" on:click={() => decryptMessage(bob, alice.encrypted)}>
      Decrypt Alice's message
    </button>
    <label>
      Decrypted message
      <textarea rows="3" bind:value={bob.decrypted} readonly></textarea>
    </label>
    {#if bob.error}
      <p class="error">{bob.error}</p>
    {/if}
  </div>
</section>

<style>
  .dh-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .dh-card {
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 1.5rem;
    background: var(--surface);
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .ceremony-card {
    margin-top: 1.5rem;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-size: 0.9rem;
  }

  input,
  textarea {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.6rem 0.75rem;
    background: var(--surface);
    color: var(--text);
    font-family: inherit;
  }

  textarea {
    resize: vertical;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .hash {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 0.78rem;
    word-break: break-all;
  }

  button {
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

  .error {
    color: #b00020;
    font-weight: 600;
  }
</style>
