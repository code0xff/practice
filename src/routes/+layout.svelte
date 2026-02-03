<script lang="ts">
  import '../app.css';
</script>

<header class="app-header">
  <div class="header-inner">
    <div class="brand">ChainLab Practice Hub</div>
    <nav>
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/sessions/intro-wallet">Practice sessions</a></li>
      </ul>
    </nav>
  </div>
</header>

<main>
  <slot />
</main>

<footer>Front-end-only practice platform with local storage · SvelteKit + TypeScript</footer>
