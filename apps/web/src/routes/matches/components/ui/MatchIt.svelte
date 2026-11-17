<script lang="ts">
  import type { MatchPerson } from '@mesaaberta/core/server/matches/service';
  import { page } from '$app/state';
  import Icon from '#lib/components/ui/Icon.svelte';
  import MAAvatar from '#lib/components/ui/MAAvatar.svelte';
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { routes } from '@mesaaberta/core/routes';
  import { backOut } from 'svelte/easing';
  import { fade, fly } from 'svelte/transition';
  import { ms, slap } from '../motion';

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
  transition:fade={{ duration: ms(180) }}
  class="punk-burst fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 overflow-y-auto p-6 text-center text-punk-ink"
>
  <!-- The rays turn slowly behind the halftone dots (still under reduced motion). -->
  <span aria-hidden="true" class="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
    <span class="punk-rays absolute -inset-1/2"></span>
    <span class="punk-dots absolute inset-0"></span>
  </span>
  <h2
    in:slap={{ delay: 120 }}
    id="match-it-title"
    class="punk-title -rotate-6 font-comic text-7xl leading-none md:text-8xl"
  >
    {m.match_it_title()}
  </h2>
  <p
    in:fly={{ y: 24, duration: ms(260), delay: ms(320) }}
    class="max-w-sm rotate-1 rounded-xl border-3 border-punk-ink bg-punk-paper px-4 py-3 font-semibold shadow-[4px_4px_0_var(--color-punk-ink)]"
  >
    {common
      ? m.match_it_lede_common({ user: `@${person.username}`, common })
      : m.match_it_lede({ user: `@${person.username}` })}
  </p>
  <div class="flex justify-center">
    <span
      in:fly={{ x: -160, duration: ms(420), delay: ms(200), easing: backOut }}
      class="flex -rotate-8 rounded-full border-4 border-punk-ink shadow-[5px_5px_0_var(--color-punk-ink)]"
    >
      <MAAvatar src={me?.avatarUrl} name={me?.username} size={120} />
    </span>
    <span
      in:fly={{ x: 160, duration: ms(420), delay: ms(200), easing: backOut }}
      class="-ml-6 flex rotate-8 rounded-full border-4 border-punk-ink shadow-[5px_5px_0_var(--color-punk-ink)]"
    >
      <MAAvatar src={person.avatarUrl} name={person.username} size={120} />
    </span>
  </div>
  <div in:fly={{ y: 32, duration: ms(260), delay: ms(420) }} class="grid w-full max-w-sm gap-3.5">
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
  /* Illustration: halftone dots over a pink and orange burst whose rays turn slowly. */
  .punk-burst {
    isolation: isolate;
  }
  .punk-dots {
    background: radial-gradient(rgb(26 11 46 / 0.16) 1.5px, transparent 2px) 0 0 / 12px 12px;
  }
  .punk-rays {
    background: repeating-conic-gradient(
      from 0deg at 50% 44%,
      var(--color-punk-pink) 0deg 10deg,
      var(--color-punk-orange) 10deg 20deg
    );
    animation: punk-spin 40s linear infinite;
  }
  @keyframes punk-spin {
    to {
      transform: rotate(1turn);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .punk-rays {
      animation: none;
    }
  }
  /* Comic lettering: yellow fill, ink outline and a hard shadow. */
  .punk-title {
    color: var(--color-punk-yellow);
    -webkit-text-stroke: 3px var(--color-punk-ink);
    paint-order: stroke fill;
    text-shadow: 6px 6px 0 var(--color-punk-ink);
  }
</style>
