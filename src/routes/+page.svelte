<script lang="ts">
  import QueryStatus from '$lib/components/QueryStatus.svelte';
  import { pageQuery } from '$lib/query/page.svelte';
  import TableCard from '$lib/components/TableCard.svelte';
  import TableIllustration from '$lib/components/TableIllustration.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  let { data: serverData } = $props();
  const remote = pageQuery(() => serverData);
  const data = $derived({ ...serverData, ...remote.data });

  const locale = getLocale();

  const steps = [
    { title: m.how_step_1_title, text: m.how_step_1_text, colour: 'bg-success-500' },
    { title: m.how_step_2_title, text: m.how_step_2_text, colour: 'bg-tertiary-400' },
    { title: m.how_step_3_title, text: m.how_step_3_text, colour: 'bg-secondary-300' },
  ];

  const seatColours = ['bg-success-500', 'bg-tertiary-400', 'bg-secondary-300'];

  const star = 'M12 2.8l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.6l-5.9 3.2 1.2-6.5L2.5 9.7l6.6-.9z';
</script>

<svelte:head>
  <title>{m.home_title()}</title>
  <meta name="description" content={m.home_description()} />
</svelte:head>
<QueryStatus failed={remote.isError} retry={() => remote.refetch()} />

{#snippet arrow()}
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="shrink-0"
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
{/snippet}

{#snippet stars(size: number)}
  <span class="flex shrink-0 gap-1">
    {#each { length: 5 }, i (i)}
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" class="fill-lamp">
        <path d={star} />
      </svg>
    {/each}
  </span>
{/snippet}

{#snippet seatDots(occupied: number, total: number)}
  <span class="inline-flex flex-wrap items-center gap-1">
    {#each { length: total }, i (i)}
      {#if i < occupied}
        <span
          class="flex size-6 items-center justify-center rounded-full {seatColours[
            i % seatColours.length
          ]}"
        >
          <span class="size-2 rounded-full bg-surface-950/30"></span>
        </span>
      {:else}
        <span class="block size-6 rounded-full border-2 border-dashed border-lamp bg-lamp-wash"
        ></span>
      {/if}
    {/each}
  </span>
{/snippet}

<section
  class="flex flex-col gap-7 pt-5 pb-3 md:min-h-160 md:flex-row md:items-center md:gap-12 md:py-0"
>
  <div class="flex max-w-2xl flex-col items-start md:flex-1">
    <p
      class="inline-flex items-center gap-2 rounded-full bg-lamp-wash py-1 pr-3 pl-2 text-sm leading-tight font-semibold text-lamp"
    >
      <span aria-hidden="true" class="block size-3 rounded-full border-2 border-dashed border-lamp"
      ></span>
      Mesas de RPG com vagas abertas
    </p>
    <h1
      class="mt-4 text-5xl leading-none font-semibold tracking-tight text-balance md:mt-5 md:text-6xl md:leading-none lg:text-7xl"
    >
      {m.hero_title_before()} <span class="text-lamp">{m.hero_title_accent()}</span>
      {m.hero_title_after()}
    </h1>
    <p class="mt-4 max-w-xs text-lg leading-normal md:mt-7 md:max-w-sm md:text-xl">
      {m.hero_lede()}
    </p>
    <div class="mt-6 flex w-full flex-col gap-2 md:mt-9 md:w-auto md:flex-row md:gap-3">
      <a
        href={localizedHref('/tables', locale)}
        class="btn h-12 w-full gap-2 rounded-lg preset-filled-primary-500 px-6 text-base font-semibold md:h-14 md:w-auto md:px-7"
      >
        {m.hero_browse_cta()}
        {@render arrow()}
      </a>
      <a
        href={localizedHref('/tables/new', locale)}
        class="btn h-12 w-full rounded-lg border-2 border-primary-500 px-6 text-base font-semibold md:h-14 md:w-auto md:px-7"
        >{m.hero_open_cta()}</a
      >
    </div>
  </div>
  <div class="mx-auto w-full max-w-xs md:mx-0 md:w-5/12 md:max-w-lg md:shrink-0">
    <TableIllustration />
  </div>
</section>

<section aria-labelledby="open-tables" class="pt-7 pb-2 md:pt-8 md:pb-14">
  <div class="flex items-end justify-between gap-4">
    <h2
      id="open-tables"
      class="text-3xl leading-none font-semibold tracking-tight text-balance md:text-4xl"
    >
      {m.home_open_tables_title()}
    </h2>
    {#if data.tables.length > 0}
      <a
        href={localizedHref('/tables', locale)}
        class="btn hidden h-12 gap-2 rounded-lg border-2 border-primary-500 px-6 font-semibold md:inline-flex"
      >
        {m.home_open_tables_all()}
        {@render arrow()}
      </a>
    {/if}
  </div>

  {#if data.tables.length > 0}
    <ul class="mt-4 grid grid-cols-1 gap-4 md:mt-7 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
      {#each data.tables as table, i (table.slug)}
        <!-- The phone layout previews two tables; the third waits on the full list. -->
        <li class={i >= 2 ? 'hidden lg:block' : ''}><TableCard {table} /></li>
      {/each}
    </ul>
    <a
      href={localizedHref('/tables', locale)}
      class="mt-4 btn h-12 w-full gap-2 rounded-lg border-2 border-primary-500 px-6 font-semibold md:hidden"
    >
      {m.home_open_tables_all()}
      {@render arrow()}
    </a>
  {:else}
    <div
      class="mt-7 rounded-lg border border-surface-200-800 bg-panel p-6 md:flex md:items-center md:justify-between md:gap-8"
    >
      <div>
        <p class="text-xl font-semibold">{m.home_open_tables_empty_title()}</p>
        <p class="mt-2 max-w-xs text-muted">{m.home_open_tables_empty_text()}</p>
      </div>
      <a
        href={localizedHref('/tables', locale)}
        class="mt-5 btn h-12 shrink-0 gap-2 rounded-lg preset-filled-primary-500 px-6 font-semibold md:mt-0"
      >
        {m.home_open_tables_all()}
        {@render arrow()}
      </a>
    </div>
  {/if}
</section>

<!-- The band runs edge to edge; its background is a pseudo-element so the content keeps the page column. -->
<section
  aria-labelledby="how-it-works"
  class="relative isolate mt-7 py-9 before:absolute before:inset-y-0 before:left-1/2 before:-z-10 before:w-screen before:-translate-x-1/2 before:border-y before:border-surface-200-800 before:bg-panel md:mt-0 md:pt-16 md:pb-24"
>
  <h2
    id="how-it-works"
    class="text-3xl leading-none font-semibold tracking-tight text-balance md:text-4xl"
  >
    {m.how_title()}
  </h2>
  <div class="relative mt-6 md:mt-11">
    <span
      aria-hidden="true"
      class="absolute top-9 right-30 left-9 hidden border-t-2 border-dashed border-surface-200-800 md:block"
    ></span>
    <ol class="relative flex flex-col gap-6 md:grid md:grid-cols-3 md:gap-12">
      {#each steps as step, i (step.title)}
        <li class="flex gap-4 md:flex-col md:items-start md:gap-0">
          <span
            class="flex size-12 shrink-0 items-center justify-center rounded-full text-2xl font-bold text-surface-950 md:size-16 md:text-4xl {step.colour}"
          >
            {i + 1}
          </span>
          <div>
            <h3
              class="text-xl leading-none font-semibold tracking-tight text-balance md:mt-5 md:text-2xl"
            >
              {step.title()}
            </h3>
            <p class="mt-1 max-w-xs text-base text-muted md:mt-2">
              {step.text()}
            </p>
          </div>
        </li>
      {/each}
    </ol>
  </div>
  <p class="mt-7 flex items-center gap-2 md:mt-11 md:gap-3 md:text-lg">
    {@render stars(20)}
    {m.how_after_session()}
  </p>
</section>

<div class="flex flex-col gap-4 pt-7 md:flex-row md:gap-6 md:pt-10">
  <section
    aria-labelledby="for-players"
    class="flex flex-col rounded-lg border border-surface-200-800 bg-panel px-6 py-8 md:min-h-192 md:flex-1 md:p-11"
  >
    <h2
      id="for-players"
      class="text-4xl leading-none font-semibold tracking-tight text-balance md:text-5xl"
    >
      {m.players_title()}
    </h2>
    <p class="mt-3 text-base md:mt-4 md:text-lg">{m.players_text()}</p>
    <div class="mt-6 md:mt-7">
      <a
        href={localizedHref('/tables', locale)}
        class="btn h-12 w-full gap-2 rounded-lg preset-filled-primary-500 px-6 text-base font-semibold md:h-14 md:w-auto md:px-7"
      >
        {m.hero_browse_cta()}
        {@render arrow()}
      </a>
    </div>

    <!-- A sample of the player's view; decorative, so it stays out of the accessibility tree. -->
    <div
      aria-hidden="true"
      class="mt-6 flex flex-col gap-3 rounded-lg border border-surface-200-800 bg-surface-50-950 p-5 md:mt-auto md:p-6"
    >
      <div class="flex items-center justify-between gap-3">
        <span class="chip h-6 rounded-full preset-filled-primary-500 px-3 text-xs font-semibold"
          >Você tem uma vaga</span
        >
        <span
          class="chip h-6 gap-1 rounded-lg border border-surface-200-800 bg-panel px-2 text-xs font-semibold"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="shrink-0"
          >
            <rect x="3" y="4.5" width="18" height="12" rx="2.5" />
            <path d="M8.5 20h7M12 16.5V20" />
          </svg>
          Foundry VTT
        </span>
      </div>
      <div>
        <p class="text-sm font-semibold text-muted">Daggerheart · Mestre: @bruno-leal</p>
        <p class="mt-1 text-2xl leading-tight font-semibold">Os Sinos de Sablewood</p>
      </div>
      <p class="flex items-start gap-2 text-base leading-normal">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="mt-1 shrink-0"
        >
          <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        </svg>
        <span
          ><strong class="font-semibold">Próxima sessão:</strong> domingo, 27 de setembro às 15:00</span
        >
      </p>
      <div class="flex items-center gap-3">
        {@render seatDots(3, 6)}
        <span class="text-sm font-semibold text-muted">3 de 6 vagas ocupadas</span>
      </div>
      <div class="flex items-center gap-3 rounded-lg bg-lamp-wash p-3">
        {@render stars(18)}
        <span class="leading-snug">Depois da sessão, avalie a mestragem.</span>
      </div>
    </div>
  </section>

  <section
    aria-labelledby="for-game-masters"
    class="relative isolate flex flex-col overflow-hidden rounded-lg bg-primary-500 px-6 py-8 text-white md:min-h-192 md:flex-1 md:p-11"
  >
    <span
      aria-hidden="true"
      class="absolute -top-36 -right-40 -z-10 size-96 rounded-full bg-white/5"
    ></span>
    <span
      aria-hidden="true"
      class="absolute -bottom-48 -left-30 -z-10 size-96 rounded-full bg-white/5"
    ></span>
    <h2
      id="for-game-masters"
      class="text-4xl leading-none font-semibold tracking-tight text-balance md:text-5xl"
    >
      {m.gm_title()}
    </h2>
    <p class="mt-3 text-base md:mt-4 md:text-lg">{m.gm_text()}</p>
    <div class="mt-6 md:mt-7">
      <a
        href={localizedHref('/tables/new', locale)}
        class="btn h-12 w-full gap-2 rounded-lg bg-white px-6 text-base font-semibold text-primary-500 md:h-14 md:w-auto md:px-7"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          class="shrink-0"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        {m.hero_open_cta()}
      </a>
    </div>

    <!-- A sample of the game master's view; decorative, so it stays out of the accessibility tree. -->
    <div
      aria-hidden="true"
      class="mt-6 flex flex-col gap-4 rounded-lg bg-panel p-5 text-surface-950-50 md:mt-auto md:p-6"
    >
      <div class="flex items-center justify-between gap-3">
        <span>
          <span class="block text-sm font-semibold text-muted">Urban Shadows 2e</span>
          <span class="text-lg font-semibold md:text-xl">Noites de Neon</span>
        </span>
        <span
          class="chip h-6 shrink-0 rounded-full border border-surface-200-800 px-3 text-xs font-semibold"
          >Campanha</span
        >
      </div>
      <div class="flex items-center gap-3">
        {@render seatDots(3, 5)}
        <span class="text-sm font-semibold text-muted">3 de 5 vagas ocupadas</span>
      </div>
      <div>
        <p class="mb-2 flex items-center gap-2 text-base font-semibold">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="shrink-0"
          >
            <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15L6 16.5zM10 20.5a2 2 0 0 0 4 0" />
          </svg>
          Pedidos de vaga (1)
        </p>
        <div class="flex items-center justify-between gap-3 rounded-lg bg-lamp-wash px-3 py-2">
          <span class="flex min-w-0 items-center gap-3 text-base">
            <span
              class="flex size-8 shrink-0 items-center justify-center rounded-full bg-tertiary-400 text-sm font-bold text-surface-950"
              >L</span
            >
            @lucas-ferreira
          </span>
          <span class="hidden items-center gap-2 md:flex">
            <span
              class="flex h-10 items-center rounded-lg preset-filled-primary-500 px-4 text-sm font-semibold"
              >Aprovar</span
            >
            <span
              class="flex h-10 items-center rounded-lg border-2 border-surface-200-800 px-4 text-sm font-semibold text-error-alert"
              >Recusar</span
            >
          </span>
        </div>
      </div>
      <div class="flex items-center justify-between gap-3 border-t border-surface-200-800 pt-3">
        <span class="text-sm font-semibold text-muted">Sua nota de mestragem</span>
        <span class="inline-flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" class="shrink-0 fill-lamp">
            <path d={star} />
          </svg>
          <span class="text-xl leading-none font-bold">4,8</span>
          <span class="text-sm font-medium text-muted">(12 avaliações)</span>
        </span>
      </div>
    </div>
  </section>
</div>
