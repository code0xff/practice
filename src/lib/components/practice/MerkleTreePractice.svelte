<script lang="ts">
  import { onMount } from 'svelte';

  type ProofStep = {
    hash: string;
    position: 'left' | 'right';
  };

  const DEFAULT_DEPTH = 3;
  const MIN_DEPTH = 2;
  const MAX_DEPTH = 4;

  let depth = DEFAULT_DEPTH;
  let leaves: string[] = [];
  let leafHashes: string[] = [];
  let treeLevels: string[][] = [];
  let merkleRoot = '';
  let selectedLeafIndex = 0;
  let proof: ProofStep[] = [];
  let rootInput = '';
  let proofValid: boolean | null = null;
  let computeToken = 0;

  const shortHash = (value: string) => {
    if (!value) return '—';
    if (value.length <= 12) return value;
    return `${value.slice(0, 6)}…${value.slice(-4)}`;
  };

  const toHex = (buffer: ArrayBuffer) =>
    Array.from(new Uint8Array(buffer))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');

  const sha256Hex = async (value: string) => {
    const encoded = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return toHex(digest);
  };

  const recomputeLeaves = () => {
    const totalLeaves = 2 ** depth;
    if (leaves.length !== totalLeaves) {
      const next = [...leaves];
      next.length = totalLeaves;
      for (let i = 0; i < totalLeaves; i += 1) {
        if (next[i] === undefined) {
          next[i] = '';
        }
      }
      leaves = next;
    }
  };

  const buildTree = async () => {
    recomputeLeaves();
    const token = (computeToken += 1);
    const hashedLeaves = await Promise.all(leaves.map((value) => sha256Hex(value)));
    if (token !== computeToken) return;
    leafHashes = hashedLeaves;
    const levels: string[][] = [hashedLeaves];
    while (levels[levels.length - 1].length > 1) {
      const current = levels[levels.length - 1];
      const nextLevel: string[] = [];
      for (let i = 0; i < current.length; i += 2) {
        const left = current[i];
        const right = current[i + 1];
        const combined = await sha256Hex(`${left}${right}`);
        nextLevel.push(combined);
      }
      levels.push(nextLevel);
    }
    if (token !== computeToken) return;
    treeLevels = levels;
    merkleRoot = levels[levels.length - 1]?.[0] ?? '';
    rootInput = merkleRoot;
    buildProof(selectedLeafIndex);
  };

  const updateLeaf = (index: number, value: string) => {
    leaves = leaves.map((item, i) => (i === index ? value : item));
    buildTree();
  };

  const handleLeafInput = (index: number, event: Event) => {
    const target = event.currentTarget as HTMLInputElement | null;
    updateLeaf(index, target ? target.value : '');
  };

  const buildProof = (index: number) => {
    if (!treeLevels.length) return;
    const steps: ProofStep[] = [];
    let currentIndex = index;
    for (let level = 0; level < treeLevels.length - 1; level += 1) {
      const siblingIndex = currentIndex ^ 1;
      const siblingHash = treeLevels[level][siblingIndex];
      if (siblingHash) {
        steps.push({
          hash: siblingHash,
          position: siblingIndex < currentIndex ? 'left' : 'right'
        });
      }
      currentIndex = Math.floor(currentIndex / 2);
    }
    proof = steps;
  };

  const selectLeaf = (index: number) => {
    selectedLeafIndex = index;
    buildProof(index);
    proofValid = null;
  };

  const verifyProof = async () => {
    if (!rootInput) {
      proofValid = false;
      return;
    }
    let currentHash = leafHashes[selectedLeafIndex];
    for (const step of proof) {
      currentHash =
        step.position === 'left'
          ? await sha256Hex(`${step.hash}${currentHash}`)
          : await sha256Hex(`${currentHash}${step.hash}`);
    }
    proofValid = currentHash === rootInput;
  };

  const resetLeaves = () => {
    leaves = leaves.map(() => '');
    buildTree();
  };

  const handleDepthInput = (event: Event) => {
    const target = event.currentTarget as HTMLInputElement | null;
    depth = target ? Number(target.value) : DEFAULT_DEPTH;
  };

  onMount(() => {
    recomputeLeaves();
    buildTree();
  });

  $: if (depth) {
    recomputeLeaves();
    buildTree();
  }
</script>

<section class="merkle-card">
  <div class="header">
    <div>
      <h3>Merkle tree builder</h3>
      <p class="subtle">
        Set the depth, enter leaf values, and explore how hashes roll up to the Merkle root.
      </p>
    </div>
    <button class="ghost" on:click={resetLeaves}>Clear leaves</button>
  </div>

  <div class="control-grid">
    <label>
      Depth
      <input
        type="number"
        min={MIN_DEPTH}
        max={MAX_DEPTH}
        step="1"
        value={depth}
        on:input={handleDepthInput}
      />
    </label>
    <div class="stat">
      <span class="stat-label">Leaves</span>
      <span class="stat-value">{Math.pow(2, depth)}</span>
    </div>
    <div class="stat">
      <span class="stat-label">Merkle root</span>
      <span class="stat-value hash" title={merkleRoot}>{shortHash(merkleRoot)}</span>
    </div>
  </div>
</section>

<section class="merkle-card">
  <h3>Leaf inputs</h3>
  <p class="subtle">Each leaf is hashed with SHA-256. Click a leaf to build a proof.</p>
  <div class="leaf-grid">
    {#each leaves as leaf, index}
      <button
        type="button"
        class:selected={index === selectedLeafIndex}
        on:click={() => selectLeaf(index)}
      >
        <span class="label">Leaf {index + 1}</span>
        <input
          type="text"
          value={leaf}
          on:input={(event) => handleLeafInput(index, event)}
          placeholder="Enter value"
        />
        <span class="hash" title={leafHashes[index]}>{shortHash(leafHashes[index])}</span>
      </button>
    {/each}
  </div>
</section>

<section class="merkle-card">
  <h3>Merkle proof</h3>
  <p class="subtle">
    Proof steps show the sibling hashes needed to verify the selected leaf.
  </p>
  {#if proof.length === 0}
    <p class="subtle">Select a leaf to generate its proof.</p>
  {:else}
    <ol class="proof-list">
      {#each proof as step}
        <li>
          <span class="chip">{step.position}</span>
          <span class="hash" title={step.hash}>{shortHash(step.hash)}</span>
        </li>
      {/each}
    </ol>
  {/if}

  <div class="verify-grid">
    <label>
      Root to verify
      <input type="text" bind:value={rootInput} placeholder="Paste Merkle root" />
    </label>
    <button class="primary" on:click={verifyProof}>Verify proof</button>
  </div>
  {#if proofValid !== null}
    <p class:valid={proofValid} class:invalid={proofValid === false}>
      {proofValid ? 'Proof is valid for the selected root.' : 'Proof does not match the root.'}
    </p>
  {/if}
</section>

<style>
  .merkle-card {
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

  .control-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
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
    padding: 0.55rem 0.75rem;
    background: var(--surface);
    color: var(--text);
  }

  .stat {
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 0.75rem;
    background: var(--background);
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .stat-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted-text);
  }

  .stat-value {
    font-weight: 600;
  }

  .hash {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 0.78rem;
    word-break: break-all;
  }

  .ghost {
    background: transparent;
    border: 1px solid transparent;
    color: var(--muted-text);
    border-radius: 999px;
    padding: 0.5rem 1.2rem;
    cursor: pointer;
  }

  .leaf-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 0.75rem;
  }

  .leaf-grid button {
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 0.75rem;
    background: var(--background);
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .leaf-grid button.selected {
    border-color: var(--text);
  }

  .leaf-grid button input {
    width: 100%;
  }

  .label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted-text);
  }

  .proof-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.5rem;
  }

  .proof-list li {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 0.5rem 0.75rem;
    background: var(--background);
  }

  .chip {
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0.2rem 0.6rem;
    font-size: 0.7rem;
    text-transform: uppercase;
    color: var(--muted-text);
  }

  .verify-grid {
    display: flex;
    gap: 0.75rem;
    align-items: flex-end;
    flex-wrap: wrap;
  }

  .primary {
    border-radius: 999px;
    border: 1px solid var(--primary);
    background: var(--primary);
    color: var(--primary-foreground);
    padding: 0.55rem 1.4rem;
    font-weight: 600;
    cursor: pointer;
  }

  .valid {
    color: #1b7f2a;
    font-weight: 600;
  }

  .invalid {
    color: #b00020;
    font-weight: 600;
  }

  @media (max-width: 720px) {
    .header {
      flex-direction: column;
    }
  }
</style>
