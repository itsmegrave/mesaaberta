<script lang="ts">
  import Spinner from './Spinner.svelte';
  import Button from '$lib/components/Button.svelte';
  import type { Snippet } from 'svelte';
  import { m } from '$lib/paraglide/messages';

  /**
   * A form's submit button. Pass the controller’s `pending`, `delayed` (500 ms) and `timeout` (8 s).
   * It is never disabled before the first attempt. From the moment the form is sent it is
   * `aria-disabled` and `aria-busy` and a second click does nothing; the spinner waits for the submit
   * to be slow, so a quick one does not flash it, and a note shows once it is very slow. It is
   * `aria-disabled`, not `disabled`, so it keeps its focus and its place in the tab order.
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
  aria-busy={submitting || delayed || undefined}
  aria-disabled={submitting || delayed || undefined}
  onclick={ignoreWhileBusy}
>
  {#if delayed}
    <Spinner />
  {/if}
  {#if timeout}{m.form_still_saving()}{:else}{@render children()}{/if}
</Button>
