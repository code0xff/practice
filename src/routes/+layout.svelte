<script lang="ts">
  import '../app.css';
</script>

<header class="app-header">
  <div class="header-inner">
    <a class="brand" href="/">ChainLab Practice Hub</a>
    <nav class="main-nav">
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/sessions/intro-wallet">Practice sessions</a></li>
      </ul>
    </nav>
  </div>
</header>

<main class="app-main">
  <slot />
</main>

<footer class="app-footer">Front-end-only practice platform with local storage | SvelteKit + TypeScript</footer>
