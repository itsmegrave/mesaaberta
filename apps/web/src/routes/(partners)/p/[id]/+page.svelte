<script lang="ts">
  // A partner's own page: its logo, name and kinds, what it says about itself, its coupon and its
  // links, with "Visitar o site" first. Whoever looks after it can edit it from here; a member who
  // does not can report it.
  import { page } from '$app/state';
  import EntityReportDialog from '#lib/components/report/EntityReportDialog.svelte';
  import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import MAButton, { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import { cardIconButtonClass } from '#lib/components/ui/MediaCard.svelte';
  import Pill from '#lib/components/ui/Pill.svelte';
  import { copyText } from '#lib/clipboard.js';
  import { m } from '#lib/paraglide/messages.js';
  import { partnerTypeLabels } from '#lib/partners/type-labels.js';
  import { networkIcons, networkLabels } from '#lib/profile/social-presentation.js';

  let { data } = $props();
  const partner = $derived(data.partner);
  let reporting = $state(false);
</script>

<svelte:head><title>{partner.name} · {m.partner_title()}</title></svelte:head>

{#if data.canReport && data.signedIn}
  {#key partner.id}
    <EntityReportDialog
      kind="partner"
      entity={{ id: partner.id, name: partner.name }}
      bind:open={reporting}
    />
  {/key}
{/if}

<section class="py-2 md:pt-12">
  <Breadcrumbs
    class="mb-8"
    items={[{ label: m.partner_nav_label(), href: '/partners' }, { label: partner.name }]}
  />

  {#if partner.pending}
    <p role="status" class="mb-8 rounded-lg border border-lamp bg-lamp-wash p-5">
      <span class="font-semibold">{m.partner_pending_badge()}.</span>
      {m.partner_page_pending()}
    </p>
  {/if}

  <div class="grid gap-8 md:grid-cols-[minmax(0,1fr)_20rem] md:gap-12">
    <header class="flex min-w-0 flex-col gap-4 md:flex-row md:items-start md:gap-6">
      <span
        class="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-wash md:size-28"
      >
        {#if partner.logoUrl}
          <img src={partner.logoUrl} alt="" class="size-full object-cover" />
        {:else}
          <Icon name="link" size={40} class="text-muted" />
        {/if}
      </span>
      <div class="flex min-w-0 flex-col gap-4">
        <h1 class="text-4xl leading-none font-semibold tracking-tight text-balance md:text-6xl">
          {partner.name}
        </h1>
        {#if partner.types.length > 0}
          <ul
            class="flex flex-wrap gap-2"
            aria-label={m.partner_types_label({ name: partner.name })}
          >
            {#each partner.types as type (type)}
              <li><Pill tone="outline">{partnerTypeLabels[type]()}</Pill></li>
            {/each}
          </ul>
        {/if}
        {#if partner.description}
          <p class="text-lg">{partner.description}</p>
        {/if}
      </div>
    </header>

    <aside class="flex flex-col gap-6">
      {#if partner.siteUrl || data.canEdit}
        <div class="flex flex-col gap-2">
          {#if partner.siteUrl}
            <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the partner's own site -->
            <a
              href={partner.siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="{buttonClass('primary')} w-full gap-2 font-semibold"
              >{m.partner_page_visit()}<Icon name="external-link" size={18} /><span class="sr-only"
                >{m.partner_opens_new_tab()}</span
              ></a
            >
          {/if}
          {#if data.canEdit}
            <a href="/p/{partner.id}/edit" class="{buttonClass('secondary')} w-full font-semibold"
              >{m.partner_menu_edit()}</a
            >
          {/if}
        </div>
      {/if}

      {#if partner.couponCode}
        <section
          aria-labelledby="partner-coupon"
          class="grid gap-2 rounded-lg border border-dashed border-primary-500 p-4"
        >
          <h2 id="partner-coupon" class="text-sm font-semibold text-muted">
            {m.partner_page_coupon()}
          </h2>
          {#if partner.couponDescription}
            <p>{partner.couponDescription}</p>
          {/if}
          <div class="flex items-center justify-between gap-3">
            <code class="font-mono text-lg font-semibold break-all">{partner.couponCode}</code>
            <MAButton
              size="custom"
              class={cardIconButtonClass}
              aria-label={m.partner_coupon_copy({ code: partner.couponCode })}
              title={m.partner_coupon_copy_short()}
              onclick={() => void copyText(partner.couponCode!, m.partner_coupon_copied())}
            >
              <Icon name="copy" size={20} />
            </MAButton>
          </div>
        </section>
      {/if}

      {#if partner.links.length > 0}
        <section aria-labelledby="partner-links" class="flex flex-col gap-1">
          <h2 id="partner-links" class="text-sm font-semibold text-muted">
            {m.partner_form_networks()}
          </h2>
          <ul class="flex flex-wrap items-center gap-1">
            {#each partner.links as link (link.network + link.url)}
              {@const network = networkLabels[link.network]()}
              <li>
                <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the partner's profile on another site -->
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
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      {#if data.canReport && !data.signedIn}
        <a
          href="/login?next={encodeURIComponent(page.url.pathname)}"
          class="{buttonClass(
            'ghost',
            'sm',
          )} -ml-3 gap-2 self-start text-sm font-semibold text-muted no-underline"
          ><Icon name="flag" size={16} />{m.partner_page_report()}</a
        >
      {:else if data.canReport}
        <MAButton
          size="sm"
          class="-ml-3 gap-2 self-start text-sm font-semibold text-muted hover:preset-tonal"
          onclick={() => (reporting = true)}
          ><Icon name="flag" size={16} />{m.partner_page_report()}</MAButton
        >
      {/if}
    </aside>
  </div>
</section>
