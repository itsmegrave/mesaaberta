<script lang="ts">
  import DialogShell from '#lib/components/ui/DialogShell.svelte';
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import MACheckbox from '#lib/components/ui/MACheckbox.svelte';
  import { m } from '#lib/paraglide/messages.js';

  // "Como funciona": the 30-second tutorial video (no sound; its captions are in the picture),
  // with "Não mostrar de novo" for the next visits.
  let { open = $bindable(false), hide = $bindable(false) }: { open: boolean; hide: boolean } =
    $props();
</script>

<DialogShell
  bind:open
  sheet
  scroll
  title={m.match_tutorial_title()}
  description={m.match_tutorial_lede()}
>
  <div class="grid gap-4">
    <video
      src="/matches/tutorial.mp4"
      poster="/matches/tutorial.jpg"
      autoplay
      muted
      loop
      playsinline
      controls
      width="400"
      height="760"
      aria-label={m.match_tutorial_video()}
      class="mx-auto aspect-400/760 max-h-[60dvh] w-auto rounded-xl border-3 border-punk-ink bg-punk-paper"
    ></video>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <MACheckbox bind:checked={hide}>{m.match_tutorial_hide()}</MACheckbox>
      <MAButton variant="primary" onclick={() => (open = false)}>{m.match_tutorial_go()}</MAButton>
    </div>
  </div>
</DialogShell>
