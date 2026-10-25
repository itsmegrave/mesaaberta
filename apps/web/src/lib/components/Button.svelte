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
  import Spinner from './Spinner.svelte';
  import { m } from '#lib/paraglide/messages.js';

  /**
   * Every button. As a form's submit button, pass the form's `controller` (an actionForm), or its
   * `submitting`, `delayed` (500 ms) and `timeout` (8 s) one by one. It is never disabled before the
   * first attempt. From the moment the form is sent it is `aria-disabled` and `aria-busy` and a
   * second click does nothing; the spinner waits for the submit to be slow, so a quick one does not
   * flash it, and a note shows once it is very slow. It is `aria-disabled`, not `disabled`, so it
   * keeps its focus and its place in the tab order.
   */
  let {
    children,
    element = $bindable(),
    type = 'button',
    size = 'md',
    variant = 'ghost',
    controller,
    submitting: submittingProp = false,
    delayed: delayedProp = false,
    timeout: timeoutProp = false,
    class: className = '',
    onclick,
    ...attributes
  }: HTMLButtonAttributes & {
    children?: Snippet;
    element?: HTMLButtonElement;
    size?: ButtonSize;
    variant?: ButtonVariant;
    /** The form's controller; its state wins over the three flags below. */
    controller?: { pending: boolean; delayed: boolean; timeout: boolean };
    submitting?: boolean;
    delayed?: boolean;
    timeout?: boolean;
  } = $props();

  const submitting = $derived(controller?.pending ?? submittingProp);
  const delayed = $derived(controller?.delayed ?? delayedProp);
  const timeout = $derived(controller?.timeout ?? timeoutProp);
  const busy = $derived(submitting || delayed);

  const click: typeof onclick = (event) => {
    if (busy) event.preventDefault();
    else onclick?.(event);
  };
</script>

<button
  bind:this={element}
  {type}
  {...attributes}
  aria-busy={busy || attributes['aria-busy'] || undefined}
  aria-disabled={busy || attributes['aria-disabled'] || undefined}
  onclick={click}
  class="{buttonClass(variant, size)} {type === 'submit' || delayed ? 'gap-2' : ''} {className}"
>
  {#if delayed}
    <Spinner />
  {/if}
  {#if timeout}{m.form_still_saving()}{:else}{@render children?.()}{/if}
</button>
