<script lang="ts">
  import Card from '$components/ui/card/card.svelte';
  import Button from '$components/ui/button/button.svelte';
  import { sessions } from '$lib/data/sessions';
</script>

<section class="section-title">
  <span class="badge">Front-end only</span>
  <h1>A blockchain practice workspace</h1>
</section>

<p class="subtle">
  Progress is saved locally in your browser, and each session gets its own page for
  managing scenarios and notes. The design leaves room to expand into IndexedDB
  storage later if needed.
</p>

<div class="grid" style="margin-top: 2rem;">
  {#each sessions as session}
    <Card>
      <div class="badge">{session.difficulty}</div>
      <h3>{session.title}</h3>
      <p class="subtle">{session.summary}</p>
      <a href={`/sessions/${session.slug}`}>
        <Button>Open session</Button>
      </a>
    </Card>
  {/each}
</div>
