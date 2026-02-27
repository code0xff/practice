<script lang="ts">
  import { getPublicKey, utils } from '@noble/secp256k1';
  import sha3 from 'js-sha3';

  type Chain = 'ethereum' | 'bitcoin' | 'cosmos';

  const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const BECH32_GENERATORS = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

  let chain: Chain = 'ethereum';
  let privateKey = '';
  let error = '';
  let loading = false;

  let ethPublicUncompressed = '';
  let ethPublicNoPrefix = '';
  let ethPubkeyKeccak = '';
  let ethAddress = '';
  let ethChecksumAddress = '';

  let cosmosPublicCompressed = '';
  let cosmosPublicUncompressed = '';
  let cosmosPubkeyHash160 = '';
  let cosmosAddress = '';
  let btcPublicCompressed = '';
  let btcPublicUncompressed = '';
  let btcPubkeyHash160 = '';
  let btcP2pkh = '';
  let btcP2shP2wpkh = '';
  let btcP2wpkh = '';

  let lastPrivateKey = '';
  let lastChain: Chain = chain;

  const strip0x = (value: string) => value.trim().replace(/^0x/i, '');
  const isHex = (value: string) => /^[0-9a-fA-F]*$/.test(value);

  const toHex = (bytes: Uint8Array) =>
    Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');

  const fromHex = (value: string) => {
    const normalized = strip0x(value);
    if (!normalized) return new Uint8Array();
    if (normalized.length % 2 !== 0) throw new Error('Hex length must be even.');
    if (!isHex(normalized)) throw new Error('Hex contains invalid characters.');
    return Uint8Array.from(normalized.match(/.{1,2}/g) ?? [], (byte) => Number(`0x${byte}`));
  };

  const toPrivateKeyBytes = () => {
    const bytes = fromHex(privateKey);
    if (bytes.length !== 32) throw new Error('Private key must be 32 bytes (64 hex chars).');
    return bytes;
  };

  const concatBytes = (...items: Uint8Array[]) => {
    const total = items.reduce((sum, item) => sum + item.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const item of items) {
      out.set(item, offset);
      offset += item.length;
    }
    return out;
  };

  const sha256 = async (input: Uint8Array) => {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) throw new Error('Web Crypto API is not available.');
    const digest = await subtle.digest('SHA-256', input as unknown as BufferSource);
    return new Uint8Array(digest);
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

  const hash160 = async (input: Uint8Array) => ripemd160(await sha256(input));

  const doubleSha256 = async (input: Uint8Array) => sha256(await sha256(input));

  const base58Encode = (bytes: Uint8Array) => {
    const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let value = 0n;
    for (const byte of bytes) value = (value << 8n) | BigInt(byte);

    let encoded = '';
    while (value > 0n) {
      const remainder = Number(value % 58n);
      value /= 58n;
      encoded = alphabet[remainder] + encoded;
    }

    let zeroPrefix = 0;
    while (zeroPrefix < bytes.length && bytes[zeroPrefix] === 0) zeroPrefix += 1;
    return `${'1'.repeat(zeroPrefix)}${encoded || ''}`;
  };

  const base58Check = async (version: number, payload: Uint8Array) => {
    const body = concatBytes(Uint8Array.of(version), payload);
    const checksum = (await doubleSha256(body)).slice(0, 4);
    return base58Encode(concatBytes(body, checksum));
  };

  const bech32Polymod = (values: number[]) => {
    let chk = 1;
    for (const value of values) {
      const top = chk >>> 25;
      chk = ((chk & 0x1ffffff) << 5) ^ value;
      for (let i = 0; i < 5; i += 1) {
        if ((top >>> i) & 1) chk ^= BECH32_GENERATORS[i];
      }
    }
    return chk;
  };

  const bech32HrpExpand = (hrp: string) => {
    const out: number[] = [];
    for (let i = 0; i < hrp.length; i += 1) out.push(hrp.charCodeAt(i) >>> 5);
    out.push(0);
    for (let i = 0; i < hrp.length; i += 1) out.push(hrp.charCodeAt(i) & 31);
    return out;
  };

  const bech32CreateChecksum = (hrp: string, data: number[]) => {
    const values = [...bech32HrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0];
    const mod = bech32Polymod(values) ^ 1;
    const checksum: number[] = [];
    for (let i = 0; i < 6; i += 1) checksum.push((mod >>> (5 * (5 - i))) & 31);
    return checksum;
  };

  const bech32Encode = (hrp: string, data: number[]) => {
    const checksum = bech32CreateChecksum(hrp, data);
    const combined = [...data, ...checksum];
    return `${hrp}1${combined.map((value) => BECH32_CHARSET[value]).join('')}`;
  };

  const convertBits = (data: Uint8Array, fromBits: number, toBits: number, pad: boolean) => {
    let acc = 0;
    let bits = 0;
    const maxv = (1 << toBits) - 1;
    const out: number[] = [];
    for (const value of data) {
      if (value < 0 || value >>> fromBits !== 0) return null;
      acc = (acc << fromBits) | value;
      bits += fromBits;
      while (bits >= toBits) {
        bits -= toBits;
        out.push((acc >>> bits) & maxv);
      }
    }
    if (pad) {
      if (bits > 0) out.push((acc << (toBits - bits)) & maxv);
    } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv)) {
      return null;
    }
    return out;
  };

  const encodeBech32Address = (hrp: string, data: Uint8Array) => {
    const words = convertBits(data, 8, 5, true);
    if (!words) throw new Error('Failed to convert data for bech32.');
    return bech32Encode(hrp, words);
  };

  const encodeSegwitAddress = (hrp: string, version: number, program: Uint8Array) => {
    const words = convertBits(program, 8, 5, true);
    if (!words) throw new Error('Failed to convert witness program for bech32.');
    return bech32Encode(hrp, [version, ...words]);
  };

  const toEip55Checksum = (addressHex: string) => {
    const lower = strip0x(addressHex).toLowerCase();
    if (lower.length !== 40) throw new Error('Address must be 20 bytes (40 hex chars).');
    const hash = sha3.keccak256(lower);
    const checksummed = lower
      .split('')
      .map((char, idx) => {
        if (!/[a-f]/.test(char)) return char;
        return parseInt(hash[idx], 16) >= 8 ? char.toUpperCase() : char;
      })
      .join('');
    return `0x${checksummed}`;
  };

  const clearDerived = () => {
    error = '';
    loading = false;
    ethPublicUncompressed = '';
    ethPublicNoPrefix = '';
    ethPubkeyKeccak = '';
    ethAddress = '';
    ethChecksumAddress = '';
    cosmosPublicCompressed = '';
    cosmosPublicUncompressed = '';
    cosmosPubkeyHash160 = '';
    cosmosAddress = '';
    btcPublicCompressed = '';
    btcPublicUncompressed = '';
    btcPubkeyHash160 = '';
    btcP2pkh = '';
    btcP2shP2wpkh = '';
    btcP2wpkh = '';
  };

  const generatePrivateKey = () => {
    privateKey = toHex(utils.randomSecretKey());
    clearDerived();
  };

  const deriveEthPublicKey = () => {
    error = '';
    try {
      const pk = toPrivateKeyBytes();
      ethPublicUncompressed = toHex(getPublicKey(pk, false));
      ethPublicNoPrefix = ethPublicUncompressed.slice(2);
      ethPubkeyKeccak = '';
      ethAddress = '';
      ethChecksumAddress = '';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to derive Ethereum public key.';
    }
  };

  const deriveEthHash = () => {
    error = '';
    if (!ethPublicNoPrefix) {
      error = 'Run Step 1 first.';
      return;
    }
    try {
      ethPubkeyKeccak = sha3.keccak256(fromHex(ethPublicNoPrefix));
      ethAddress = '';
      ethChecksumAddress = '';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to hash public key.';
    }
  };

  const deriveEthAddress = () => {
    error = '';
    if (!ethPubkeyKeccak) {
      error = 'Run Step 2 first.';
      return;
    }
    ethAddress = `0x${ethPubkeyKeccak.slice(-40)}`;
    ethChecksumAddress = '';
  };

  const deriveEthChecksum = () => {
    error = '';
    if (!ethAddress) {
      error = 'Run Step 3 first.';
      return;
    }
    try {
      ethChecksumAddress = toEip55Checksum(ethAddress);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to derive checksum address.';
    }
  };

  const deriveCosmosPublicKey = () => {
    error = '';
    try {
      const pk = toPrivateKeyBytes();
      cosmosPublicCompressed = toHex(getPublicKey(pk, true));
      cosmosPublicUncompressed = toHex(getPublicKey(pk, false));
      cosmosPubkeyHash160 = '';
      cosmosAddress = '';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to derive Cosmos public key.';
    }
  };

  const deriveBtcPublicKey = () => {
    error = '';
    try {
      const pk = toPrivateKeyBytes();
      btcPublicCompressed = toHex(getPublicKey(pk, true));
      btcPublicUncompressed = toHex(getPublicKey(pk, false));
      btcPubkeyHash160 = '';
      btcP2pkh = '';
      btcP2shP2wpkh = '';
      btcP2wpkh = '';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to derive Bitcoin public key.';
    }
  };

  const deriveBtcHash160 = async () => {
    error = '';
    if (!btcPublicCompressed) {
      error = 'Run Step 1 first.';
      return;
    }
    loading = true;
    try {
      const pubKeyHash = await hash160(fromHex(btcPublicCompressed));
      btcPubkeyHash160 = toHex(pubKeyHash);
      btcP2pkh = '';
      btcP2shP2wpkh = '';
      btcP2wpkh = '';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to compute HASH160.';
    } finally {
      loading = false;
    }
  };

  const deriveBtcAddressTypes = async () => {
    error = '';
    if (!btcPubkeyHash160) {
      error = 'Run Step 2 first.';
      return;
    }
    loading = true;
    try {
      const pubKeyHash = fromHex(btcPubkeyHash160);
      const redeemScript = concatBytes(Uint8Array.of(0x00, 0x14), pubKeyHash);
      const redeemHash = await hash160(redeemScript);

      btcP2pkh = await base58Check(0x00, pubKeyHash);
      btcP2shP2wpkh = await base58Check(0x05, redeemHash);
      btcP2wpkh = encodeSegwitAddress('bc', 0, pubKeyHash);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to derive Bitcoin addresses.';
    } finally {
      loading = false;
    }
  };

  const deriveCosmosHash160 = async () => {
    error = '';
    if (!cosmosPublicCompressed) {
      error = 'Run Step 1 first.';
      return;
    }
    loading = true;
    try {
      const pubKeyHash = await hash160(fromHex(cosmosPublicCompressed));
      cosmosPubkeyHash160 = toHex(pubKeyHash);
      cosmosAddress = '';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to compute HASH160.';
    } finally {
      loading = false;
    }
  };

  const deriveCosmosAddress = () => {
    error = '';
    if (!cosmosPubkeyHash160) {
      error = 'Run Step 2 first.';
      return;
    }
    try {
      cosmosAddress = encodeBech32Address('cosmos', fromHex(cosmosPubkeyHash160));
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to derive Cosmos address.';
    }
  };

  const runAll = async () => {
    if (chain === 'ethereum') {
      deriveEthPublicKey();
      if (error) return;
      deriveEthHash();
      if (error) return;
      deriveEthAddress();
      if (error) return;
      deriveEthChecksum();
      return;
    }

    if (chain === 'bitcoin') {
      deriveBtcPublicKey();
      if (error) return;
      await deriveBtcHash160();
      if (error) return;
      await deriveBtcAddressTypes();
      return;
    }

    deriveCosmosPublicKey();
    if (error) return;
    await deriveCosmosHash160();
    if (error) return;
    deriveCosmosAddress();
  };

  $: if (privateKey !== lastPrivateKey || chain !== lastChain) {
    lastPrivateKey = privateKey;
    lastChain = chain;
    clearDerived();
  }
</script>

<section class="lab-card">
  <div class="header">
    <div>
      <h3>Address derivation lab</h3>
      <p class="subtle">
        Choose Ethereum, Bitcoin, or Cosmos, then derive addresses step-by-step from the same
        private key.
      </p>
    </div>
    <button class="ghost" on:click={generatePrivateKey}>Generate private key</button>
  </div>

  <div class="selector-grid">
    <label class="chain-label">
      Chain
      <div class="select-wrap">
        <select class="chain-select" bind:value={chain}>
          <option value="ethereum">Ethereum</option>
          <option value="bitcoin">Bitcoin</option>
          <option value="cosmos">Cosmos</option>
        </select>
      </div>
    </label>
    <label>
      Private key (hex)
      <input type="text" bind:value={privateKey} placeholder="0x..." />
    </label>
  </div>

  <div class="button-row">
    <button class="primary" on:click={runAll} disabled={!privateKey.trim() || loading}>
      {loading ? 'Running...' : 'Run all steps'}
    </button>
  </div>
  {#if error}
    <p class="error">{error}</p>
  {/if}
</section>

{#if chain === 'ethereum'}
  <section class="lab-card">
    <h3>Step 1: Derive uncompressed public key</h3>
    <button class="step" on:click={deriveEthPublicKey} disabled={!privateKey.trim() || loading}>
      Run step 1
    </button>
    <label>
      Public key (65 bytes, starts with 04)
      <textarea rows="2" value={ethPublicUncompressed} readonly></textarea>
    </label>
  </section>

  <section class="lab-card">
    <h3>Step 2: Keccak256(publicKey[1:])</h3>
    <button class="step" on:click={deriveEthHash} disabled={!ethPublicNoPrefix || loading}>
      Run step 2
    </button>
    <label>
      Public key without prefix
      <textarea rows="2" value={ethPublicNoPrefix} readonly></textarea>
    </label>
    <label>
      Keccak256 hash
      <textarea rows="2" value={ethPubkeyKeccak} readonly></textarea>
    </label>
  </section>

  <section class="lab-card">
    <h3>Step 3: Take last 20 bytes (40 hex chars)</h3>
    <button class="step" on:click={deriveEthAddress} disabled={!ethPubkeyKeccak || loading}>
      Run step 3
    </button>
    <label>
      Lowercase address
      <input type="text" value={ethAddress} readonly />
    </label>
  </section>

  <section class="lab-card">
    <h3>Step 4: Apply EIP-55 checksum</h3>
    <button class="step" on:click={deriveEthChecksum} disabled={!ethAddress || loading}>
      Run step 4
    </button>
    <label>
      Checksum address
      <input type="text" value={ethChecksumAddress} readonly />
    </label>
  </section>
{:else if chain === 'bitcoin'}
  <section class="lab-card">
    <h3>Step 1: Derive public keys</h3>
    <button class="step" on:click={deriveBtcPublicKey} disabled={!privateKey.trim() || loading}>
      Run step 1
    </button>
    <label>
      Compressed public key (33 bytes)
      <textarea rows="2" value={btcPublicCompressed} readonly></textarea>
    </label>
    <label>
      Uncompressed public key (65 bytes)
      <textarea rows="2" value={btcPublicUncompressed} readonly></textarea>
    </label>
  </section>

  <section class="lab-card">
    <h3>Step 2: HASH160(compressed pubkey)</h3>
    <button class="step" on:click={deriveBtcHash160} disabled={!btcPublicCompressed || loading}>
      Run step 2
    </button>
    <label>
      HASH160(pubkey)
      <input type="text" value={btcPubkeyHash160} readonly />
    </label>
  </section>

  <section class="lab-card">
    <h3>Step 3: Compare Bitcoin address types</h3>
    <button class="step" on:click={deriveBtcAddressTypes} disabled={!btcPubkeyHash160 || loading}>
      Run step 3
    </button>
    <label>
      P2PKH (legacy)
      <input type="text" value={btcP2pkh} readonly />
    </label>
    <label>
      P2SH-P2WPKH (nested SegWit)
      <input type="text" value={btcP2shP2wpkh} readonly />
    </label>
    <label>
      P2WPKH (bech32)
      <input type="text" value={btcP2wpkh} readonly />
    </label>
  </section>
{:else}
  <section class="lab-card">
    <h3>Step 1: Derive public keys</h3>
    <button class="step" on:click={deriveCosmosPublicKey} disabled={!privateKey.trim() || loading}>
      Run step 1
    </button>
    <label>
      Compressed public key (33 bytes)
      <textarea rows="2" value={cosmosPublicCompressed} readonly></textarea>
    </label>
    <label>
      Uncompressed public key (65 bytes)
      <textarea rows="2" value={cosmosPublicUncompressed} readonly></textarea>
    </label>
  </section>

  <section class="lab-card">
    <h3>Step 2: HASH160(compressed pubkey)</h3>
    <button class="step" on:click={deriveCosmosHash160} disabled={!cosmosPublicCompressed || loading}>
      Run step 2
    </button>
    <label>
      HASH160(pubkey)
      <input type="text" value={cosmosPubkeyHash160} readonly />
    </label>
  </section>

  <section class="lab-card">
    <h3>Step 3: Bech32 cosmos address</h3>
    <button class="step" on:click={deriveCosmosAddress} disabled={!cosmosPubkeyHash160 || loading}>
      Run step 3
    </button>
    <label>
      Cosmos account address
      <input type="text" value={cosmosAddress} readonly />
    </label>
  </section>
{/if}

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
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  .selector-grid {
    display: grid;
    grid-template-columns: 180px 1fr;
    gap: 0.75rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    font-size: 0.9rem;
  }

  .chain-label {
    align-self: end;
  }

  .select-wrap {
    position: relative;
  }

  .select-wrap::after {
    content: '';
    position: absolute;
    right: 0.8rem;
    top: 50%;
    width: 0.45rem;
    height: 0.45rem;
    border-right: 2px solid var(--muted);
    border-bottom: 2px solid var(--muted);
    transform: translateY(-60%) rotate(45deg);
    pointer-events: none;
  }

  .chain-select {
    appearance: none;
    -webkit-appearance: none;
    width: 100%;
    padding: 0.75rem 2rem 0.75rem 0.9rem;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: linear-gradient(180deg, var(--surface) 0%, var(--accent) 100%);
    color: var(--text);
    font-size: 0.92rem;
    font-weight: 600;
    cursor: pointer;
    transition: box-shadow 0.15s ease, border-color 0.15s ease;
  }

  .chain-select:focus {
    outline: none;
    border-color: var(--text);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--text) 12%, transparent);
  }

  .button-row {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  button {
    border-radius: 999px;
    border: 1px solid transparent;
    padding: 0.55rem 1.1rem;
    font-weight: 600;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.55;
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
    color: var(--muted);
  }

  .step {
    align-self: flex-start;
    background: var(--accent);
    border-color: var(--border);
    color: var(--text);
  }

  .error {
    margin: 0;
    color: #b42318;
    font-size: 0.9rem;
  }

  textarea,
  input,
  select {
    font-family: inherit;
  }

  textarea,
  input {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 0.84rem;
    word-break: break-all;
  }

  @media (max-width: 760px) {
    .header {
      flex-direction: column;
    }

    .selector-grid {
      grid-template-columns: 1fr;
    }

    .chain-label {
      align-self: stretch;
    }
  }
</style>
