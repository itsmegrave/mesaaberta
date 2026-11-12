<script lang="ts">
  import type { MatchPerson } from '@mesaaberta/core/server/matches/service';
  import { page } from '$app/state';
  import Icon from '#lib/components/ui/Icon.svelte';
  import MAAvatar from '#lib/components/ui/MAAvatar.svelte';
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { routes } from '@mesaaberta/core/routes';

  // "Bora jogar!": both said yes. Full screen over the deck, until they write, look at the profile
  // or go back to the deck (Esc too).
  let { person, onclose }: { person: MatchPerson; onclose: () => void } = $props();

  const me = $derived(page.data.account as { username: string | null; avatarUrl: string | null });
  const common = $derived(
    [
      person.commonSystems[0]?.name,
      person.commonSlots > 0 ? m.match_common_slots({ count: person.commonSlots }) : null,
    ]
      .filter(Boolean)
      .join(m.match_and()),
  );
  let first: HTMLButtonElement | undefined = $state();
  $effect(() => first?.focus());
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && onclose()} />

<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="match-it-title"
  class="punk-burst fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 overflow-y-auto p-6 text-center text-punk-ink"
>
  <h2 id="match-it-title" class="punk-title -rotate-6 font-comic text-7xl leading-none md:text-8xl">
    {m.match_it_title()}
  </h2>
  <p
    class="max-w-sm rotate-1 rounded-xl border-3 border-punk-ink bg-punk-paper px-4 py-3 font-semibold shadow-[4px_4px_0_var(--color-punk-ink)]"
  >
    {common
      ? m.match_it_lede_common({ user: `@${person.username}`, common })
      : m.match_it_lede({ user: `@${person.username}` })}
  </p>
  <div class="flex justify-center">
    <span
      class="flex -rotate-8 rounded-full border-4 border-punk-ink shadow-[5px_5px_0_var(--color-punk-ink)]"
    >
      <MAAvatar src={me?.avatarUrl} name={me?.username} size={120} />
    </span>
    <span
      class="-ml-6 flex rotate-8 rounded-full border-4 border-punk-ink shadow-[5px_5px_0_var(--color-punk-ink)]"
    >
      <MAAvatar src={person.avatarUrl} name={person.username} size={120} />
    </span>
  </div>
  <div class="grid w-full max-w-sm gap-3.5">
    <form method="POST" action="{routes.profile(person.username)}?/message">
      <MAButton
        bind:element={first}
        type="submit"
        size="custom"
        class="inline-flex h-13 w-full items-center justify-center gap-2 rounded-full border-3 border-punk-ink bg-punk-yellow font-comic text-2xl shadow-[4px_4px_0_var(--color-punk-ink)] focus-visible:outline-punk-ink"
      >
        <Icon name="send" size={20} />{m.match_it_message()}
      </MAButton>
    </form>
    <a
      href={routes.profile(person.username)}
      class="inline-flex h-12 items-center justify-center gap-2 rounded-full border-3 border-punk-ink bg-punk-paper font-bold focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-punk-ink"
    >
      {m.match_it_profile()}
    </a>
    <MAButton
      size="custom"
      onclick={onclose}
      class="h-11 font-extrabold underline decoration-2 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-punk-ink"
    >
      {m.match_it_keep_going()}
    </MAButton>
  </div>
</div>

<style>
  /* Illustration: a pink and orange burst with halftone dots. */
  .punk-burst {
    background:
      radial-gradient(rgb(26 11 46 / 0.16) 1.5px, transparent 2px) 0 0 / 12px 12px,
      repeating-conic-gradient(
        from 0deg at 50% 38%,
        var(--color-punk-pink) 0deg 10deg,
        var(--color-punk-orange) 10deg 20deg
      );
  }
  /* Comic lettering: yellow fill, ink outline and a hard shadow. */
  .punk-title {
    color: var(--color-punk-yellow);
    -webkit-text-stroke: 3px var(--color-punk-ink);
    paint-order: stroke fill;
    text-shadow: 6px 6px 0 var(--color-punk-ink);
  }
</style>
