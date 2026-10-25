<script module lang="ts">
  export type ButtonSize = 'md' | 'sm' | 'icon' | 'custom';
  export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

  const sizes: Record<ButtonSize, string> = {
    md: 'h-12 rounded-lg px-4',
    sm: 'h-11 rounded-lg px-3',
    icon: 'size-12 rounded-lg p-0',
    custom: '',
  };
  const variants: Record<ButtonVariant, string> = {
    primary: 'preset-filled-primary-500',
    secondary: 'border-2 border-surface-200-800 hover:preset-tonal',
    danger: 'preset-filled-error-500',
    ghost: '',
  };

  /**
   * The classes of a Button, for an element that must look like one but is not a `<button>`: a link,
   * a dialog's close trigger, a menu's trigger.
   */
  export function buttonClass(variant: ButtonVariant = 'ghost', size: ButtonSize = 'md'): string {
    return [
      size === 'custom' ? '' : 'btn',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:opacity-50',
      sizes[size],
      variants[variant],
    ]
      .filter(Boolean)
      .join(' ');
  }
</script>

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
    size?: ButtonSize;
    variant?: ButtonVariant;
  } = $props();
</script>

<button bind:this={element} {type} {...attributes} class="{buttonClass(variant, size)} {className}">
  {@render children?.()}
</button>
