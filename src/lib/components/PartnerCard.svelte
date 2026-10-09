<script lang="ts">
  // One partner of the "Parceiros" page: the logo, the name, an optional line about them, the coupon
  // they give Mesa Aberta members (if any) and one icon per link. Every icon is a link of its own
  // that opens in a new tab and says so. The card does not say who sent it: only admins see that.
  import Icon from '$lib/components/Icon.svelte';
  import KebabMenu, { type KebabItem } from '$lib/components/KebabMenu.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import type { Network } from '$lib/profile/social-links';
  import { networkIcons, networkLabels } from '$lib/profile/social-presentation';
  import { toast } from '$lib/toaster';

  type Partner = {
    id: string;
    name: string;
    description: string | null;
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
    canEdit = false,
    onreport,
    onwithdraw,
  }: {
    partner: Partner;
    /** The viewer sent this partner: "Editar" and "Remover…" are offered. */
    canEdit?: boolean;
    /** Offered to a signed-in member who did not send it; without it there is no "Denunciar…". */
    onreport?: (partner: Partner) => void;
    onwithdraw?: (partner: Partner) => void;
  } = $props();

  const locale = getLocale();

  // The site comes first, with the globe; the networks follow in the order they were sent.
  const icons = $derived([
    ...(partner.siteUrl ? [{ network: 'website' as Network, url: partner.siteUrl }] : []),
    ...partner.links,
  ]);

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(done);
    } catch {
      // Clipboard access refused: nothing was copied, and nothing is claimed.
    }
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
            href: localizedHref(`/partners/${partner.id}/edit`, locale),
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

<article
  class="flex h-full flex-col overflow-hidden rounded-lg border border-surface-200-800 bg-panel"
>
  <div class="relative flex aspect-5/2 shrink-0 items-center justify-center bg-surface-wash">
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
    {#if partner.pending}
      <span
        class="absolute top-3 left-3 chip h-6 preset-filled-warning-500 px-3 text-xs font-semibold shadow-sm"
        >{m.partner_pending_badge()}</span
      >
    {/if}
  </div>

  <div class="flex flex-1 flex-col gap-2 p-4">
    <h3 class="text-lg leading-snug font-semibold text-balance">{partner.name}</h3>
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
          <button
            type="button"
            class="btn size-11 shrink-0 rounded-lg p-0 text-muted hover:preset-tonal"
            aria-label={m.partner_coupon_copy({ code: partner.couponCode })}
            title={m.partner_coupon_copy_short()}
            onclick={() => void copy(partner.couponCode!, m.partner_coupon_copied())}
          >
            <Icon name="copy" size={20} />
          </button>
        </div>
        {#if partner.couponDescription}
          <p class="text-sm text-muted">{partner.couponDescription}</p>
        {/if}
      </div>
    {/if}

    <div class="mt-auto flex items-center justify-between gap-3 pt-2">
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
    </div>
  </div>
</article>
