<script lang="ts">
  export let variant: 'primary' | 'secondary' = 'primary';
  export let type: 'button' | 'submit' | 'reset' = 'button';

  export let className = '';
</script>

<button
  class={`button ${variant === 'secondary' ? 'secondary' : ''} ${className}`.trim()}
  {type}
  {...$$restProps}
>
  <slot />
</button>
