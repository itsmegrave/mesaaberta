<script lang="ts">
  import UserLink from '#lib/components/ui/UserLink.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import { kindLabel, openedLabel, seatsLeftLabel, type TableKind } from '#lib/tables/format.js';
  import { formatCardDate, formatSession } from '@mesaaberta/core/tables/format';
  import { shownTimezone } from '#lib/time/shown-timezone.js';
  import { getLocale } from '#lib/paraglide/runtime.js';
  import GmRating from './GmRating.svelte';
  import { linkedCardClass } from './MediaCard.svelte';

  /**
   * A table that just opened, in the "Novas mesas" carousel: a smaller TableCard that leads with how
   * long ago it was published. The full TableCard stays in Mesas abertas, /t and the profile.
   */
  let {
    table,
    now,
  }: {
    table: {
      slug: string;
      title: string;
      kind: TableKind;
      system: { name: string };
      gmName: string;
      gmRating?: { score: number | null; count: number; isNew: boolean };
      seatsLeft: number;
      timezone: string;
      startsAt: Date;
      publishedAt: Date | null;
      imageUrl?: string | null;
      modality?: 'online' | 'in_person';
      locationArea?: string | null;
    };
    /** The instant the list was read, so every card's "Aberta há…" counts from the same moment. */
    now: Date;
  } = $props();

  const locale = getLocale();
  const timeZone = $derived(shownTimezone(table.timezone));
  const cardDate = $derived(formatCardDate(table.startsAt, timeZone, locale));
  const opened = $derived(table.publishedAt ? openedLabel(table.publishedAt, now) : null);
  const where = $derived(
    table.modality === 'in_person' && table.locationArea
      ? table.locationArea
      : kindLabel(table.kind),
  );
</script>

<article class="{linkedCardClass} h-80 w-full">
  <div class="relative h-28 shrink-0 overflow-hidden bg-primary-500">
    {#if table.imageUrl}
      <img
        src={table.imageUrl}
        alt=""
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
        class="absolute inset-0 size-full object-cover"
      />
    {/if}
    {#if opened}
      <span
        class="absolute top-3 left-3 chip h-6 bg-panel px-3 text-xs font-semibold text-surface-950-50 shadow-sm"
      >
        {opened}
      </span>
    {/if}
    <span
      class="absolute bottom-3 left-3 rounded-lg preset-filled-primary-500 px-3 py-1.5 leading-none shadow-sm"
    >
      <span class="text-base font-bold tracking-tight">{cardDate.dayMonth}</span>
      <span class="text-xs font-medium"> · {cardDate.weekdayTime}</span>
    </span>
  </div>

  <time datetime={table.startsAt.toISOString()} class="sr-only">
    {formatSession(table.startsAt, timeZone, locale)}
  </time>

  <div class="flex min-h-0 grow flex-col gap-2 px-4 pt-4 pb-3">
    <div class="truncate text-sm font-semibold text-muted">{table.system.name}</div>
    <h3 class="line-clamp-2 text-xl leading-tight font-semibold tracking-tight">
      <a
        href={`/t/${table.slug}`}
        class="after:absolute after:inset-0 after:content-[''] hover:underline"
      >
        {table.title}
      </a>
    </h3>
    <div class="flex min-w-0 items-center gap-2 text-sm text-muted">
      <!-- A 24px line keeps the handle a 24px target apart from the card's stretched link (WCAG 2.5.8). -->
      <UserLink username={table.gmName} class="inline-block min-w-0 truncate leading-6" />
      {#if table.gmRating}<GmRating rating={table.gmRating} class="text-xs" />{/if}
    </div>
    <div
      class="mt-auto flex min-w-0 items-center justify-between gap-3 border-t border-surface-200-800 pt-3"
    >
      <span class="text-base font-semibold whitespace-nowrap text-lamp">
        {seatsLeftLabel(table.seatsLeft)}
      </span>
      <span class="flex min-w-0 items-center gap-1 text-xs font-semibold text-muted">
        {#if table.modality === 'in_person'}<Icon name="map-pin" size={14} />{/if}
        <span class="truncate">{where}</span>
      </span>
    </div>
  </div>
</article>
