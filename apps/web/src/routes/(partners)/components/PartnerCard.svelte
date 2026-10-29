<script lang="ts">
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import { copyText } from '#lib/clipboard.js';
  // One partner of the "Parceiros" page: the logo, the name, an optional line about them, the coupon
  // they give Mesa Aberta members (if any) and one icon per link. Its kinds sit under the name. Every icon is a link of its own
  // that opens in a new tab and says so. The card does not say who sent it: only admins see that.
  import Icon from '#lib/components/ui/Icon.svelte';
  import KebabMenu, { type KebabItem } from '#lib/components/ui/KebabMenu.svelte';
  import MediaCard, { cardIconButtonClass } from '#lib/components/ui/MediaCard.svelte';
  import { m } from '#lib/paraglide/messages.js';

  import type { Network } from '@mesaaberta/core/profile/social-links';
  import type { PartnerType } from '@mesaaberta/core/partners/types';
  import Pill from '#lib/components/ui/Pill.svelte';
  import { partnerTypeLabels } from '#lib/partners/type-labels.js';
  import { networkIcons, networkLabels } from '#lib/profile/social-presentation.js';

  type Partner = {
    id: string;
    name: string;
    description: string | null;
    /** Its kinds, in the list's order; none for a partner sent before there were kinds. */
    types: PartnerType[];
    logoUrl: string | null;
    siteUrl: string | null;
    couponCode: string | null;
    couponDescription: string | null;
    /** Waits for an admin: only its submitter sees it, so it says so. */
    pending?: boolean;
    links: { network: Exclude<Network, 'website'>; url: string }[];
  };

  let {
    partner,
    href,
    canEdit = false,
    onreport,
    onwithdraw,
  }: {
    partner: Partner;
    /** Its own page (`use_directory_links`): the name links there. */
    href?: string;
    /** The viewer sent this partner: "Editar" and "Remover…" are offered. */
    canEdit?: boolean;
    /** Offered to a signed-in member who did not send it; without it there is no "Denunciar…". */
    onreport?: (partner: Partner) => void;
    onwithdraw?: (partner: Partner) => void;
  } = $props();

  // The site comes first, with the globe; the networks follow in the order they were sent.
  const icons = $derived([
    ...(partner.siteUrl ? [{ network: 'website' as Network, url: partner.siteUrl }] : []),
    ...partner.links,
  ]);

  function copy(text: string, done: string) {
    return copyText(text, done);
  }

  const items = $derived<KebabItem[]>([
    ...(partner.siteUrl
      ? [
          {
            id: 'copy',
            label: m.partner_menu_copy_site(),
            icon: 'copy' as const,
            onselect: () => void copy(partner.siteUrl!, m.toast_link_copied()),
          },
        ]
      : []),
    ...(onreport
      ? [
          {
            id: 'report',
            label: m.partner_menu_report(),
            icon: 'flag' as const,
            onselect: () => onreport(partner),
          },
        ]
      : []),
    ...(canEdit
      ? [
          {
            id: 'edit',
            label: m.partner_menu_edit(),
            icon: 'square-pen' as const,
            href: `/p/${partner.id}/edit`,
          },
          {
            id: 'withdraw',
            label: m.partner_menu_withdraw(),
            icon: 'trash' as const,
            destructive: true,
            onselect: () => onwithdraw?.(partner),
          },
        ]
      : []),
  ]);
</script>

<MediaCard
  mediaClass="flex items-center justify-center"
  pill={partner.pending ? m.partner_pending_badge() : undefined}
  pillTone="warning"
>
  {#snippet media()}
    {#if partner.logoUrl}
      <!-- Calculated: the logo is square and keeps its shape inside the 5:2 wash. -->
      <img
        src={partner.logoUrl}
        alt=""
        loading="lazy"
        decoding="async"
        class="size-20 rounded-lg object-cover"
      />
    {:else}
      <Icon name="link" size={40} class="text-muted" />
    {/if}
  {/snippet}

  <h3 class="text-lg leading-snug font-semibold text-balance">
    {#if href}
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the page passes /p/<id> -->
      <a {href} class="underline-offset-4 hover:underline">{partner.name}</a>
    {:else}
      {partner.name}
    {/if}
  </h3>
  {#if partner.types.length > 0}
    <ul class="flex flex-wrap gap-2" aria-label={m.partner_types_label({ name: partner.name })}>
      {#each partner.types as type (type)}
        <li><Pill tone="muted">{partnerTypeLabels[type]()}</Pill></li>
      {/each}
    </ul>
  {/if}
  {#if partner.description}
    <p class="text-sm text-muted">{partner.description}</p>
  {/if}
  {#if partner.couponCode}
    <div class="grid gap-1 rounded-lg border border-dashed border-primary-500 p-3">
      <div class="flex items-center justify-between gap-3">
        <p class="min-w-0 text-sm">
          <Icon name="ticket-percent" size={20} class="mr-1 inline align-text-bottom" />
          <span class="font-semibold">{m.partner_coupon_label()}:</span>
          <code class="font-mono font-semibold break-all">{partner.couponCode}</code>
        </p>
        <MAButton
          size="custom"
          class={cardIconButtonClass}
          aria-label={m.partner_coupon_copy({ code: partner.couponCode })}
          title={m.partner_coupon_copy_short()}
          onclick={() => void copy(partner.couponCode!, m.partner_coupon_copied())}
        >
          <Icon name="copy" size={20} />
        </MAButton>
      </div>
      {#if partner.couponDescription}
        <p class="text-sm text-muted">{partner.couponDescription}</p>
      {/if}
    </div>
  {/if}

  {#snippet footer()}
    <ul class="flex min-w-0 flex-wrap items-center gap-1">
      {#each icons as link (link.network + link.url)}
        {@const network = networkLabels[link.network]()}
        <li>
          <!-- eslint-disable svelte/no-navigation-without-resolve -- the partner's own site or profile on another site, not an app route -->
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            class="btn size-11 rounded-full p-0 text-surface-950-50 hover:preset-tonal"
            aria-label={m.partner_link_label({ network, name: partner.name })}
            title={network}
          >
            <Icon name={networkIcons[link.network]} size={22} />
          </a>
          <!-- eslint-enable svelte/no-navigation-without-resolve -->
        </li>
      {/each}
    </ul>
    {#if items.length > 0}
      <KebabMenu name={m.partner_menu_label({ name: partner.name })} {items} />
    {/if}
  {/snippet}
</MediaCard>
