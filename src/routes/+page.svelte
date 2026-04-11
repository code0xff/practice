<script lang="ts">
  import Card from '$components/ui/card/card.svelte';
  import Button from '$components/ui/button/button.svelte';
  import { sessions } from '$lib/data/sessions';

  const totalSessions = sessions.length;
  const difficultyGroups = new Set(sessions.map((session) => session.difficulty)).size;
</script>

<section class="hero">
  <div class="hero-copy">
    <span class="badge">Local-first frontend lab</span>
    <h1>Blockchain concepts, practiced through interactive sessions</h1>
    <p class="subtle">
      Each lab is stateful in your browser, so you can resume experiments instantly while we keep
      the stack simple and fast.
    </p>
  </div>
  <div class="hero-meta">
    <div class="hero-stat">
      <strong>{totalSessions}</strong>
      <span class="subtle">Hands-on sessions</span>
    </div>
    <div class="hero-stat">
      <strong>{difficultyGroups}</strong>
      <span class="subtle">Difficulty tiers from beginner to intermediate</span>
    </div>
  </div>
</section>

<section class="section-title">
  <span class="badge warm">Session library</span>
  <h2>Choose your next lab</h2>
</section>
<div class="grid">
  {#each sessions as session}
    <Card className="session-card">
      <div class="badge">{session.difficulty}</div>
      <h3>{session.title}</h3>
      <p class="subtle">{session.summary}</p>
      <a href={`/sessions/${session.slug}`}>
        <Button>Start lab</Button>
      </a>
    </Card>
  {/each}
</div>
