<script lang="ts">
  import { copyText } from '#lib/clipboard.js';
  import PostButton from '#lib/components/PostButton.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import MAButton, { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import PageHead from '#lib/components/ui/PageHead.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { calendarFeedSchema } from '@mesaaberta/core/calendar/feed-form';
  import type { ActionResult } from '$app/forms';

  type FeedUrls = { https: string; webcal: string; google: string };

  let { data } = $props();
  // The address just made: the server keeps only its hash, so this is the one time it is shown.
  let fresh = $state<FeedUrls | null>(null);

  function keepFeed(result: ActionResult) {
    if (result.type !== 'success') return;
    fresh = (result.data?.feed as FeedUrls | null | undefined) ?? null;
  }
</script>

<section class="py-2 md:pt-12">
  <PageHead
    crumbs={[{ label: m.dash_title(), href: '/u/tables' }, { label: m.calendar_feed_crumb() }]}
    title={m.calendar_feed_title()}
    lede={m.calendar_feed_lede()}
  />

  <div
    class="mt-6 grid max-w-2xl gap-4 rounded-lg border border-surface-200-800 bg-panel p-5 md:mt-8"
  >
    {#if fresh}
      <div class="flex flex-col gap-3 sm:flex-row">
        <a href={fresh.webcal} class="{buttonClass('primary', 'md')} gap-2 font-semibold">
          <Icon name="calendar" size={20} />
          {m.calendar_feed_open_app()}
        </a>
        <a
          href={fresh.google}
          target="_blank"
          rel="noopener noreferrer"
          class="{buttonClass('secondary', 'md')} gap-2 font-semibold"
        >
          <Icon name="external-link" size={20} />
          {m.calendar_feed_google()}
        </a>
      </div>
      <div>
        <label for="calendar-feed-url" class="text-sm font-semibold">
          {m.calendar_feed_address()}
        </label>
        <div class="mt-1 flex gap-2">
          <input
            id="calendar-feed-url"
            class="input h-11 min-w-0 flex-1 rounded-lg font-mono text-sm"
            readonly
            value={fresh.https}
            onfocus={(event) => event.currentTarget.select()}
          />
          <MAButton
            variant="secondary"
            size="icon"
            aria-label={m.calendar_feed_copy()}
            onclick={() => void copyText(fresh!.https, m.toast_link_copied())}
          >
            <Icon name="copy" size={20} />
          </MAButton>
        </div>
        <p class="mt-2 text-sm text-muted">{m.calendar_feed_private()}</p>
        <p class="mt-2 text-sm font-semibold">{m.calendar_feed_shown_once()}</p>
      </div>
      <p class="text-sm text-muted">{m.calendar_feed_refresh_hint()}</p>
    {:else if data.on}
      <p>{m.calendar_feed_active()}</p>
    {/if}
    {#if fresh || data.on}
      <div class="flex flex-wrap gap-3">
        <PostButton
          action="?/feed"
          fields={{ on: 'true' }}
          schema={calendarFeedSchema}
          errorMessage={m.form_error_invalid}
          success={m.calendar_feed_renewed()}
          onResult={keepFeed}
          buttonClass="{buttonClass('secondary', 'sm')} gap-2"
        >
          <Icon name="refresh-cw" size={16} />
          {m.calendar_feed_renew()}
        </PostButton>
        <PostButton
          action="?/feed"
          fields={{ on: 'false' }}
          schema={calendarFeedSchema}
          errorMessage={m.form_error_invalid}
          success={m.calendar_feed_stopped()}
          onResult={keepFeed}
          buttonClass={buttonClass('ghost', 'sm')}
        >
          {m.calendar_feed_stop()}
        </PostButton>
      </div>
    {:else}
      <p>{m.calendar_feed_none()}</p>
      <PostButton
        action="?/feed"
        fields={{ on: 'true' }}
        schema={calendarFeedSchema}
        errorMessage={m.form_error_invalid}
        success={m.calendar_feed_created()}
        onResult={keepFeed}
        buttonClass="{buttonClass('primary', 'md')} gap-2 font-semibold"
      >
        <Icon name="calendar" size={20} />
        {m.calendar_feed_create()}
      </PostButton>
    {/if}
  </div>
</section>
