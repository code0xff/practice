<script lang="ts">
  import { onMount } from 'svelte';
  import Card from '$components/ui/card/card.svelte';
  import Button from '$components/ui/button/button.svelte';
  import BitcoinPowSimulator from '$lib/components/practice/BitcoinPowSimulator.svelte';
  import UtxoSimulator from '$lib/components/practice/UtxoSimulator.svelte';
  import UtxoScriptSimulator from '$lib/components/practice/UtxoScriptSimulator.svelte';
  import KeccakHashPractice from '$lib/components/practice/KeccakHashPractice.svelte';
  import MerkleTreePractice from '$lib/components/practice/MerkleTreePractice.svelte';
  import DiffieHellmanChatPractice from '$lib/components/practice/DiffieHellmanChatPractice.svelte';
  import PbftSimulator from '$lib/components/practice/PbftSimulator.svelte';
  import LegacyTxLab from '$lib/components/practice/LegacyTxLab.svelte';
  import { loadProgress, updateProgress } from '$lib/stores/practice';
  import type { PracticeSession } from '$lib/data/sessions';

  export let data: { session: PracticeSession | null };

  let notes = '';
  let completed = false;
  let lastUpdated = '';

  onMount(() => {
    if (!data.session) return;
    const stored = loadProgress(data.session);
    notes = stored.notes;
    completed = stored.completed;
    lastUpdated = stored.lastUpdated;
  });

  const handleSave = () => {
    if (!data.session) return;
    updateProgress(data.session, { notes, completed });
    lastUpdated = new Date().toISOString();
  };

  const toggleComplete = () => {
    completed = !completed;
    handleSave();
  };
</script>

{#if !data.session}
  <Card>
    <h2>We couldn't find that session.</h2>
    <p class="subtle">Return to the session list and choose another one.</p>
    <a href="/">
      <Button variant="secondary">Back to home</Button>
    </a>
  </Card>
{:else}
  <section class="section-title">
    <div>
      <span class="badge">{data.session.difficulty}</span>
    </div>
    <div>
      <h2>{data.session.title}</h2>
      <p class="subtle">{data.session.summary}</p>
    </div>
  </section>

  <div class="session-meta">
    <span class="badge">Status: {completed ? 'Completed' : 'In progress'}</span>
    {#if lastUpdated}
      <span class="badge">Last saved: {new Date(lastUpdated).toLocaleString('en-US')}</span>
    {/if}
  </div>

  <div class="grid">
    <Card>
      <h3>Learning goals</h3>
      <ul class="subtle">
        {#each data.session.goals as goal}
          <li>{goal}</li>
        {/each}
      </ul>
    </Card>

    <Card>
      <h3>Practice checklist</h3>
      <ol class="subtle">
        {#each data.session.tasks as task}
          <li>{task}</li>
        {/each}
      </ol>
    </Card>
  </div>

  {#if data.session.slug === 'intro-wallet'}
    <BitcoinPowSimulator />
  {:else if data.session.slug === 'utxo-simulation'}
    <UtxoSimulator />
  {:else if data.session.slug === 'utxo-script-machine'}
    <UtxoScriptSimulator />
  {:else if data.session.slug === 'keccak-hash'}
    <KeccakHashPractice />
  {:else if data.session.slug === 'merkle-tree'}
    <MerkleTreePractice />
  {:else if data.session.slug === 'dh-chat'}
    <DiffieHellmanChatPractice />
  {:else if data.session.slug === 'pbft-simulation'}
    <PbftSimulator />
  {:else if data.session.slug === 'legacy-tx-lab'}
    <LegacyTxLab />
  {/if}

  <Card className="" style="margin-top: 1.5rem;">
    <h3>Session notes</h3>
    <p class="subtle">Capture ideas or questions that come up during the exercise.</p>
    <textarea bind:value={notes} placeholder="Write your notes here"></textarea>
    <div style="display: flex; gap: 0.75rem; margin-top: 1rem;">
      <Button on:click={handleSave}>Save notes</Button>
      <Button variant="secondary" on:click={toggleComplete}>
        {completed ? 'Mark as in progress' : 'Mark as completed'}
      </Button>
    </div>
  </Card>
{/if}
