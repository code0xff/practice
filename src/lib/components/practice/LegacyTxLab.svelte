<script lang="ts">
  import { getPublicKey, sign, utils } from '@noble/secp256k1';
  import sha3 from 'js-sha3';

  type LegacyTx = {
    nonce: string;
    gasPrice: string;
    gasLimit: string;
    to: string;
    value: string;
    data: string;
    chainId: string;
  };

  type SignatureState = {
    recovery: number | null;
    r: string;
    s: string;
    v: string;
    signedRlp: string;
    rawTx: string;
    error: string;
  };

  const defaultTx: LegacyTx = {
    nonce: '0',
    gasPrice: '20000000000',
    gasLimit: '21000',
    to: '',
    value: '0',
    data: '',
    chainId: '1'
  };

  let tx: LegacyTx = { ...defaultTx };
  let privateKey = '';
  let publicKey = '';
  let address = '';
  let keyError = '';

  let unsignedRlpHex = '';
  let unsignedHashHex = '';
  let unsignedHashBytes: Uint8Array | null = null;
  let rlpErrors: string[] = [];

  let signature: SignatureState = {
    recovery: null,
    r: '',
    s: '',
    v: '',
    signedRlp: '',
    rawTx: '',
    error: ''
  };

  const resetSignature = () => {
    signature = {
      recovery: null,
      r: '',
      s: '',
      v: '',
      signedRlp: '',
      rawTx: '',
      error: ''
    };
  };

  const strip0x = (value: string) => value.trim().replace(/^0x/i, '');

  const isHex = (value: string) => /^[0-9a-fA-F]*$/.test(value);

  const toHex = (bytes: Uint8Array) =>
    Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');

  const fromHex = (value: string) => {
    const normalized = strip0x(value);
    if (!normalized) return new Uint8Array();
    if (normalized.length % 2 !== 0) {
      throw new Error('Hex string must have an even length.');
    }
    if (!isHex(normalized)) {
      throw new Error('Hex string contains invalid characters.');
    }
    return Uint8Array.from(normalized.match(/.{1,2}/g) ?? [], (byte) => Number(`0x${byte}`));
  };

  const toPrivateKeyBytes = (value: string) => {
    const bytes = fromHex(value);
    if (bytes.length !== 32) {
      throw new Error('Private key must be 32 bytes (64 hex chars).');
    }
    return bytes;
  };

  const bigintToBytes = (value: bigint) => {
    if (value === 0n) return new Uint8Array();
    let hex = value.toString(16);
    if (hex.length % 2 !== 0) hex = `0${hex}`;
    return fromHex(hex);
  };

  const parseNumber = (value: string, field: string) => {
    const normalized = value.trim();
    if (!normalized) return 0n;
    if (normalized.startsWith('0x') || normalized.startsWith('0X')) {
      const hex = strip0x(normalized);
      if (!isHex(hex)) throw new Error(`${field} must be hex or decimal.`);
      return BigInt(`0x${hex || '0'}`);
    }
    if (!/^[0-9]+$/.test(normalized)) throw new Error(`${field} must be hex or decimal.`);
    return BigInt(normalized);
  };

  const concatBytes = (items: Uint8Array[]) => {
    const total = items.reduce((sum, item) => sum + item.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const item of items) {
      result.set(item, offset);
      offset += item.length;
    }
    return result;
  };

  const encodeLength = (len: number, offset: number) => {
    if (len < 56) return Uint8Array.of(len + offset);
    const lenBytes = bigintToBytes(BigInt(len));
    return concatBytes([Uint8Array.of(offset + 55 + lenBytes.length), lenBytes]);
  };

  const rlpEncode = (input: Uint8Array | Uint8Array[]): Uint8Array => {
    if (input instanceof Uint8Array) {
      if (input.length === 1 && input[0] < 0x80) return input;
      return concatBytes([encodeLength(input.length, 0x80), input]);
    }
    const output = input.map((item) => rlpEncode(item));
    const payload = concatBytes(output);
    return concatBytes([encodeLength(payload.length, 0xc0), payload]);
  };

  const generatePrivateKey = () => {
    privateKey = toHex(utils.randomSecretKey());
    updateKeyMaterial();
  };

  const updateKeyMaterial = () => {
    keyError = '';
    resetSignature();
    if (!privateKey.trim()) {
      publicKey = '';
      address = '';
      return;
    }
    try {
      const pub = getPublicKey(toPrivateKeyBytes(privateKey), false);
      publicKey = toHex(pub);
      const pubBytes = pub.slice(1);
      const hash = new Uint8Array(sha3.keccak256.arrayBuffer(pubBytes));
      address = toHex(hash.slice(-20));
    } catch (error) {
      keyError = error instanceof Error ? error.message : 'Invalid private key.';
      publicKey = '';
      address = '';
    }
  };

  const computeUnsigned = () => {
    const nextErrors: string[] = [];
    let unsignedBytes: Uint8Array | null = null;
    try {
      const nonceBytes = bigintToBytes(parseNumber(tx.nonce, 'Nonce'));
      const gasPriceBytes = bigintToBytes(parseNumber(tx.gasPrice, 'Gas price'));
      const gasLimitBytes = bigintToBytes(parseNumber(tx.gasLimit, 'Gas limit'));
      const valueBytes = bigintToBytes(parseNumber(tx.value, 'Value'));
      const chainId = parseNumber(tx.chainId, 'Chain ID');

      let toBytes = new Uint8Array();
      if (tx.to.trim()) {
        toBytes = fromHex(tx.to);
        if (toBytes.length !== 20) {
          throw new Error('To address must be 20 bytes (40 hex chars).');
        }
      }

      let dataBytes = new Uint8Array();
      if (tx.data.trim()) {
        dataBytes = fromHex(tx.data);
      }

      const chainIdBytes = bigintToBytes(chainId);
      const payload = [
        nonceBytes,
        gasPriceBytes,
        gasLimitBytes,
        toBytes,
        valueBytes,
        dataBytes,
        chainIdBytes,
        new Uint8Array(),
        new Uint8Array()
      ];
      unsignedBytes = rlpEncode(payload);
      unsignedRlpHex = toHex(unsignedBytes);
      unsignedHashBytes = new Uint8Array(sha3.keccak256.arrayBuffer(unsignedBytes));
      unsignedHashHex = toHex(unsignedHashBytes);
    } catch (error) {
      nextErrors.push(error instanceof Error ? error.message : 'Failed to build unsigned tx.');
      unsignedRlpHex = '';
      unsignedHashHex = '';
      unsignedHashBytes = null;
    }
    rlpErrors = nextErrors;
  };

  const signTransaction = () => {
    signature.error = '';
    resetSignature();
    if (!unsignedHashBytes) {
      signature.error = 'Build the unsigned transaction first.';
      return;
    }
    if (!privateKey.trim()) {
      signature.error = 'Enter a private key before signing.';
      return;
    }
    try {
      const sig = sign(unsignedHashBytes, toPrivateKeyBytes(privateKey), {
        prehash: false,
        format: 'recovered'
      });
      const sigBytes = sig instanceof Uint8Array ? sig : Uint8Array.from(sig);
      const rBytes = sigBytes.slice(0, 32);
      const sBytes = sigBytes.slice(32, 64);
      const recovery = sigBytes[64];
      const chainId = parseNumber(tx.chainId, 'Chain ID');
      const v = BigInt(recovery) + 35n + chainId * 2n;

      const signedPayload = [
        bigintToBytes(parseNumber(tx.nonce, 'Nonce')),
        bigintToBytes(parseNumber(tx.gasPrice, 'Gas price')),
        bigintToBytes(parseNumber(tx.gasLimit, 'Gas limit')),
        tx.to.trim() ? fromHex(tx.to) : new Uint8Array(),
        bigintToBytes(parseNumber(tx.value, 'Value')),
        tx.data.trim() ? fromHex(tx.data) : new Uint8Array(),
        bigintToBytes(v),
        rBytes,
        sBytes
      ];
      const signedBytes = rlpEncode(signedPayload);

      signature = {
        recovery,
        r: toHex(rBytes),
        s: toHex(sBytes),
        v: v.toString(),
        signedRlp: toHex(signedBytes),
        rawTx: `0x${toHex(signedBytes)}`,
        error: ''
      };
    } catch (error) {
      signature.error = error instanceof Error ? error.message : 'Failed to sign.';
    }
  };

  const resetTx = () => {
    tx = { ...defaultTx };
  };

  $: updateKeyMaterial();
  $: computeUnsigned();
  $: if (unsignedHashHex) {
    resetSignature();
  }
</script>

<section class="lab-card">
  <div class="header">
    <h3>Step 1: Key generation</h3>
    <button class="ghost" on:click={generatePrivateKey}>Generate private key</button>
  </div>
  <label>
    Private key (hex)
    <input type="text" bind:value={privateKey} placeholder="0x..." />
  </label>
  <label>
    Public key (uncompressed)
    <input type="text" value={publicKey} readonly />
  </label>
  <label>
    Address (keccak256(pubkey[1:]) last 20 bytes)
    <input type="text" value={address} readonly />
  </label>
  {#if keyError}
    <p class="error">{keyError}</p>
  {/if}
</section>

<section class="lab-card">
  <div class="header">
    <h3>Step 2: LegacyTx fields</h3>
    <button class="ghost" on:click={resetTx}>Reset fields</button>
  </div>
  <div class="field-grid">
    <label>
      Nonce
      <input type="text" bind:value={tx.nonce} placeholder="0 or 0x00" />
    </label>
    <label>
      Gas price (wei)
      <input type="text" bind:value={tx.gasPrice} placeholder="20000000000" />
    </label>
    <label>
      Gas limit
      <input type="text" bind:value={tx.gasLimit} placeholder="21000" />
    </label>
    <label>
      To (20-byte hex address)
      <input type="text" bind:value={tx.to} placeholder="0x..." />
    </label>
    <label>
      Value (wei)
      <input type="text" bind:value={tx.value} placeholder="0" />
    </label>
    <label>
      Data (hex)
      <input type="text" bind:value={tx.data} placeholder="0x" />
    </label>
    <label>
      Chain ID
      <input type="text" bind:value={tx.chainId} placeholder="1" />
    </label>
  </div>
  {#if rlpErrors.length}
    <ul class="error-list">
      {#each rlpErrors as err}
        <li class="error">{err}</li>
      {/each}
    </ul>
  {/if}
</section>

<section class="lab-card">
  <h3>Step 3: RLP encode + keccak256 hash</h3>
  <label>
    Unsigned RLP (hex)
    <textarea rows="3" readonly value={unsignedRlpHex}></textarea>
  </label>
  <label>
    Unsigned transaction hash
    <textarea rows="2" readonly value={unsignedHashHex}></textarea>
  </label>
</section>

<section class="lab-card">
  <div class="header">
    <h3>Step 4: Sign the hash</h3>
    <button class="primary" on:click={signTransaction}>Sign transaction</button>
  </div>
  <div class="field-grid">
    <label>
      Recovery ID
      <input type="text" value={signature.recovery ?? ''} readonly />
    </label>
    <label>
      v
      <input type="text" value={signature.v} readonly />
    </label>
    <label>
      r
      <input type="text" value={signature.r} readonly />
    </label>
    <label>
      s
      <input type="text" value={signature.s} readonly />
    </label>
  </div>
  {#if signature.error}
    <p class="error">{signature.error}</p>
  {/if}
</section>

<section class="lab-card">
  <h3>Step 5: Signed transaction payload</h3>
  <label>
    Signed RLP (hex)
    <textarea rows="3" readonly value={signature.signedRlp}></textarea>
  </label>
  <label>
    Raw transaction (eth_sendRawTransaction)
    <textarea rows="2" readonly value={signature.rawTx}></textarea>
  </label>
</section>

<style>
  .lab-card {
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
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .field-grid {
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

  input,
  textarea {
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 0.7rem 0.8rem;
    background: var(--surface);
    color: var(--text);
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 0.85rem;
  }

  textarea {
    resize: vertical;
  }

  .primary {
    background: var(--primary);
    color: var(--primary-foreground);
    border: none;
    border-radius: 999px;
    padding: 0.55rem 1.4rem;
    font-weight: 600;
    cursor: pointer;
  }

  .ghost {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--muted-text);
    border-radius: 999px;
    padding: 0.45rem 1.2rem;
    cursor: pointer;
  }

  .error {
    color: #f87171;
    font-size: 0.85rem;
  }

  .error-list {
    margin: 0;
    padding-left: 1.2rem;
    display: grid;
    gap: 0.25rem;
  }
</style>
