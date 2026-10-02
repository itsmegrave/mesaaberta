<script lang="ts">
  import Spinner from './Spinner.svelte';
  import Button from '$lib/components/Button.svelte';
  import type { Snippet } from 'svelte';
  import { m } from '$lib/paraglide/messages';

  /**
   * A form's submit button. Pass the controller’s `pending`, `delayed` (500 ms) and `timeout` (8 s). From the moment the form is sent a second click
   * does nothing; a spinner shows once the submit is slow, and a note once it is very slow. While
   * busy it is `aria-disabled`, not `disabled`, so it keeps its focus and its place in the tab order.
   */
  let {
    submitting = false,
    delayed = false,
    timeout = false,
    class: className = '',
    children,
  }: {
    submitting?: boolean;
    delayed?: boolean;
    timeout?: boolean;
    class?: string;
    children: Snippet;
  } = $props();

  const ignoreWhileBusy = (event: MouseEvent) => {
    if (submitting || delayed) event.preventDefault();
  };
</script>

<Button
  size="custom"
  type="submit"
  class="gap-2 {className}"
  aria-busy={delayed || undefined}
  aria-disabled={delayed || undefined}
  onclick={ignoreWhileBusy}
>
  {#if delayed}
    <Spinner />
  {/if}
  {#if timeout}{m.form_still_saving()}{:else}{@render children()}{/if}
</Button>
