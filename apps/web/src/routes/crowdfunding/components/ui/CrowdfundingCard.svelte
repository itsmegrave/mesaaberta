<script lang="ts">
  // One campaign of the list. The card opens the campaign's own page on another site, so it is one
  // link that says it leaves (a new tab, with the site named for a screen reader); "Denunciar" sits
  // above that link as a button of its own.
  import Icon from '#lib/components/ui/Icon.svelte';
  import MediaCard, { cardIconButtonClass } from '#lib/components/ui/MediaCard.svelte';
  import { periodLabel } from '#lib/crowdfunding/format.js';
  import { platformLabel, siteName, submissionLabel } from '#lib/crowdfunding/labels.js';
  import { hostOf, type CrowdfundingPlatform } from '@mesaaberta/core/crowdfunding/platforms';
  import { campaignReferralUrl } from '#lib/crowdfunding/referral.js';
  import { situationOf } from '#lib/crowdfunding/situation.js';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';

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

<MediaCard linked mediaClass="overflow-hidden" pill={platformLabel(campaign.platform)}>
  {#snippet media()}
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
  {/snippet}

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
    class="text-sm font-semibold {situation.warn ? 'text-lamp' : ''}"
    data-warn={situation.warn || undefined}
  >
    {situation.text}
  </p>
  {#snippet footer()}
    <p class="flex min-w-0 items-center gap-1.5 text-sm text-muted">
      {#if !campaign.submitter}
        <Icon name="import" size={16} class="shrink-0" />
      {/if}
      <span class="truncate">{submissionLabel(campaign.submitter, campaign.importSource)}</span>
    </p>
    {#if onreport}
      <button
        type="button"
        class="relative z-10 {cardIconButtonClass}"
        aria-label={m.crowdfunding_report_trigger({ name: campaign.name })}
        title={m.report_trigger()}
        onclick={() => onreport(campaign)}
      >
        <Icon name="flag" size={20} />
      </button>
    {/if}
  {/snippet}
</MediaCard>
