<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  let {
    children,
    element = $bindable(),
    type = 'button',
    size = 'md',
    variant = 'ghost',
    class: className = '',
    ...attributes
  }: HTMLButtonAttributes & {
    children?: Snippet;
    element?: HTMLButtonElement;
    size?: 'md' | 'sm' | 'icon' | 'custom';
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  } = $props();
  const sizes = {
    md: 'h-12 rounded-lg px-4',
    sm: 'h-11 rounded-lg px-3',
    icon: 'size-12 rounded-lg p-0',
    custom: '',
  };
  const variants = {
    primary: 'preset-filled-primary-500',
    secondary: 'border-2 border-surface-200-800 hover:preset-tonal',
    danger: 'preset-filled-error-500',
    ghost: '',
  };
</script>

<button
  bind:this={element}
  {type}
  {...attributes}
  class="{size === 'custom'
    ? ''
    : 'btn'} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:opacity-50 {sizes[
    size
  ]} {variants[variant]} {className}"
>
  {@render children?.()}
</button>
