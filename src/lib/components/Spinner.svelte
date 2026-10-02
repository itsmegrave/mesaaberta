<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';
  let { size = 18, class: className = '' }: { size?: number; class?: string } = $props();
  let motion = $state(false);
  onMount(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => (motion = !preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  });
</script>

<Icon name="svg-spinners:tadpole" {size} {motion} class={className} />
