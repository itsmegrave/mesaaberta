<script lang="ts">
  // A place in Onde jogar: its photo (or its kind's drawing) with the kind in the corner, the name
  // as the card's one link to its page, the area, two lines of description, up to two amenities and
  // the tables open there now. Draws only what it is given.
  import Icon from '#lib/components/ui/Icon.svelte';
  import MediaCard from '#lib/components/ui/MediaCard.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import {
    placeAmenityLabels,
    placeArea,
    placeKindIcons,
    placeKindLabels,
  } from '#lib/places/labels.js';
  import type { PlaceAmenity, PlaceKind } from '@mesaaberta/core/places/types';

  let {
    place,
  }: {
    place: {
      slug: string;
      name: string;
      kind: PlaceKind;
      neighbourhood: string | null;
      city: string;
      state: string;
      description: string | null;
      amenities: PlaceAmenity[];
      imageUrl: string | null;
      openTables: number;
    };
  } = $props();

  // The card has room for two; the page lists them all.
  const SHOWN_AMENITIES = 2;
</script>

<MediaCard
  linked
  pill={placeKindLabels[place.kind]()}
  pillTone="plain"
  mediaClass="overflow-hidden"
>
  {#snippet media()}
    {#if place.imageUrl}
      <img src={place.imageUrl} alt="" loading="lazy" class="size-full object-cover" />
    {:else}
      <div class="flex size-full items-center justify-center">
        <span class="flex size-20 items-center justify-center rounded-lg preset-filled-primary-500">
          <Icon name={placeKindIcons[place.kind]} size={40} />
        </span>
      </div>
    {/if}
  {/snippet}

  <h2 class="text-xl leading-tight font-semibold tracking-tight text-balance">
    <a
      href="/pp/{place.slug}"
      class="no-underline after:absolute after:inset-0 focus-visible:outline-none">{place.name}</a
    >
  </h2>
  <p class="flex items-center gap-1 text-sm font-semibold text-muted">
    <Icon name="map-pin" size={16} />{placeArea(place)}
  </p>
  {#if place.description}<p class="line-clamp-2 text-sm text-muted">{place.description}</p>{/if}
  {#if place.amenities.length > 0}
    <ul class="mt-1 flex flex-wrap gap-1">
      {#each place.amenities.slice(0, SHOWN_AMENITIES) as amenity (amenity)}
        <li
          class="inline-flex h-7 items-center rounded-lg bg-surface-wash px-2 text-xs font-semibold"
        >
          {placeAmenityLabels[amenity]()}
        </li>
      {/each}
    </ul>
  {/if}

  {#snippet footer()}
    <div
      class="flex w-full items-center justify-between gap-3 border-t border-surface-200-800 pt-3"
    >
      <span class="font-semibold {place.openTables > 0 ? 'text-lamp' : 'text-muted'}"
        >{place.openTables > 0
          ? m.directory_open_tables({ count: place.openTables })
          : m.systems_none_open()}</span
      >
      <span
        aria-hidden="true"
        class="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-wash"
      >
        <Icon name="chevron-right" size={18} />
      </span>
    </div>
  {/snippet}
</MediaCard>
