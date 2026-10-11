<script lang="ts">
  // One campaign of the list. The card opens the campaign's own page on another site, so it is one
  // link that says it leaves (a new tab, with the site named for a screen reader); "Denunciar" sits
  // above that link as a button of its own.
  import Icon from '$lib/components/Icon.svelte';
  import { periodLabel } from '$lib/crowdfunding/format';
  import { platformLabel, siteName, submissionLabel } from '$lib/crowdfunding/labels';
  import { hostOf, type CrowdfundingPlatform } from '$lib/crowdfunding/platforms';
  import { campaignReferralUrl } from '$lib/crowdfunding/referral';
  import { situationOf } from '$lib/crowdfunding/situation';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  type Campaign = {
    id: string;
    name: string;
    owner: string;
    url: string;
    platform: CrowdfundingPlatform;
    startsOn: string;
    endsOn: string;
    imageUrl: string | null;
    submitter: string | null;
    importSource?: 'catarse' | 'meeplestarter' | null;
  };

  let {
    campaign,
    onreport,
  }: {
    campaign: Campaign;
    /** Offered to a signed-in member who did not add it; without it there is no button. */
    onreport?: (campaign: Campaign) => void;
  } = $props();

  const locale = getLocale();
  const situation = $derived(situationOf(campaign, locale));
  const site = $derived(siteName(campaign.platform, campaign.url));
</script>

<article
  class="group relative flex h-full flex-col overflow-hidden rounded-lg border border-surface-200-800 bg-panel transition-shadow focus-within:ring-2 focus-within:ring-warning-500 hover:shadow-md"
>
  <div class="relative aspect-5/2 shrink-0 overflow-hidden bg-surface-wash">
    {#if campaign.imageUrl}
      <img
        src={campaign.imageUrl}
        alt=""
        loading="lazy"
        decoding="async"
        class="absolute inset-0 size-full object-cover"
      />
    {:else}
      <!-- No picture: a plain tile with the chest and the site's name. -->
      <div class="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted">
        <Icon name="game-icons:open-treasure-chest" size={40} />
        <span class="text-sm font-semibold">{hostOf(campaign.url)}</span>
      </div>
    {/if}
    <span
      class="absolute top-3 left-3 chip h-6 preset-filled-primary-500 px-3 text-xs font-semibold shadow-sm"
      >{platformLabel(campaign.platform)}</span
    >
  </div>

  <div class="flex flex-1 flex-col gap-2 p-4">
    <h3 class="text-lg leading-snug font-semibold text-balance">
      <!-- eslint-disable svelte/no-navigation-without-resolve -- the campaign's own page on another site, not an app route -->
      <a
        href={campaignReferralUrl(campaign.url)}
        target="_blank"
        rel="noopener noreferrer"
        class="no-underline after:absolute after:inset-0 after:content-['']"
      >
        {campaign.name}<Icon name="external-link" size={16} class="ml-1 inline align-baseline" />
        <span class="sr-only"> {m.crowdfunding_opens_new_tab({ site })}</span>
      </a>
      <!-- eslint-enable svelte/no-navigation-without-resolve -->
    </h3>
    <p class="text-sm text-muted">
      <span class="font-semibold">{m.crowdfunding_owner_label()}:</span>
      {campaign.owner}
    </p>
    <p class="text-sm text-muted">{periodLabel(campaign.startsOn, campaign.endsOn, locale)}</p>
    <p
      class="text-sm font-semibold {situation.warn ? 'text-warning-700-300' : ''}"
      data-warn={situation.warn || undefined}
    >
      {situation.text}
    </p>
    <div class="mt-auto flex items-center justify-between gap-3 pt-2">
      <p class="min-w-0 truncate text-sm text-muted">
        {submissionLabel(campaign.submitter, campaign.importSource)}
      </p>
      {#if onreport}
        <button
          type="button"
          class="relative z-10 btn size-11 shrink-0 rounded-lg p-0 text-muted hover:preset-tonal"
          aria-label={m.crowdfunding_report_trigger({ name: campaign.name })}
          title={m.report_trigger()}
          onclick={() => onreport(campaign)}
        >
          <Icon name="flag" size={20} />
        </button>
      {/if}
    </div>
  </div>
</article>
