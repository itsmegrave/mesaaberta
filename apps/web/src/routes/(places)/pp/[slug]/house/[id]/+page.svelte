<script lang="ts">
  import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import MAAvatar from '#lib/components/ui/MAAvatar.svelte';
  import { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import Pill from '#lib/components/ui/Pill.svelte';
  import PostButton from '#lib/components/PostButton.svelte';
  import StatusBadge from '#lib/components/ui/StatusBadge.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';
  import { placeKindLabels } from '#lib/places/labels.js';
  import { toast } from '#lib/toaster.js';
  import { atHandle } from '@mesaaberta/core/profile/handle';
  import { z } from 'zod';

  // The invite to be a place's house GM: its name, picture and kind, who invited, then the answer.
  // While it waits a notice says until when; once answered (or lapsed, or cancelled) a StatusBadge
  // says how it ended, and an accepted one links to the place's page.
  let { data } = $props();
  const invitation = $derived(data.invitation);
  const place = $derived(invitation.place);
  // A pending invite past its deadline has lapsed, even before anything marks it; so has one whose
  // place left the list.
  const status = $derived(
    invitation.status === 'pending' &&
      (place.removed || new Date(invitation.expiresAt) <= new Date())
      ? place.removed
        ? 'cancelled'
        : 'expired'
      : invitation.status,
  );
  const until = $derived(
    new Intl.DateTimeFormat(getLocale(), { dateStyle: 'full' }).format(
      new Date(invitation.expiresAt),
    ),
  );
  const schema = z.object({});
</script>

<svelte:head
  ><title>{place.name} · {m.place_host_invitation_title()} · Mesa Aberta</title><meta
    name="robots"
    content="noindex"
  /></svelte:head
>
<section class="mx-auto max-w-2xl py-8 md:py-8">
  <Breadcrumbs
    items={[
      { label: m.places_crumb(), href: '/places' },
      { label: place.name, href: `/pp/${place.slug}` },
      { label: m.place_host_invitation_title() },
    ]}
  />
  <div class="mt-6 rounded-lg border border-surface-200-800 bg-panel p-6">
    <p class="text-sm font-semibold text-muted">{m.place_host_invitation_title()}</p>
    <div class="mt-3 flex items-center gap-4">
      <MAAvatar src={place.imageUrl} name={place.name} size={56} />
      <div class="min-w-0">
        <h1 class="text-3xl leading-tight font-semibold tracking-tight wrap-break-word">
          {place.name}
        </h1>
        <div class="mt-2"><Pill tone="muted">{placeKindLabels[place.kind]()}</Pill></div>
      </div>
    </div>
    <p class="mt-4">{m.place_host_invitation_from({ inviter: atHandle(invitation.inviter) })}</p>

    {#if status === 'pending'}
      <div
        role="status"
        class="mt-4 flex items-start gap-3 rounded-lg border border-warning-500 bg-lamp-wash px-4 py-3"
      >
        <Icon name="clock" size={20} class="mt-0.5 shrink-0 text-lamp" />
        <div class="min-w-0">
          <p class="font-semibold">{m.invitation_status_pending()}</p>
          <p class="mt-1 text-sm">
            {m.place_host_invitation_explain()}
            {m.partner_invitation_until({ date: until })}
          </p>
        </div>
      </div>
      <div class="mt-5 flex flex-col gap-3 sm:flex-row">
        <PostButton
          action="?/accept"
          {schema}
          errorMessage={m.partner_invitation_error}
          onFailure={() => toast.error(m.partner_invitation_error())}
          buttonClass="{buttonClass('primary', 'md')} w-full font-semibold sm:w-auto"
          >{m.partner_invitation_accept()}</PostButton
        >
        <PostButton
          action="?/decline"
          {schema}
          errorMessage={m.partner_invitation_error}
          success={m.partner_invitation_declined()}
          onFailure={() => toast.error(m.partner_invitation_error())}
          buttonClass="{buttonClass('secondary', 'md')} w-full font-semibold sm:w-auto"
          >{m.partner_invitation_decline()}</PostButton
        >
      </div>
    {:else}
      <div class="mt-4 flex flex-col items-start gap-3">
        <StatusBadge status="invitation:{status}" />
        {#if status === 'accepted' && !place.removed}
          <p>{m.place_host_invitation_accepted({ place: place.name })}</p>
          <a href="/pp/{place.slug}" class="{buttonClass('secondary', 'md')} font-semibold"
            >{m.place_host_invitation_open()}</a
          >
        {:else}
          <a href="/places" class="anchor">{m.place_host_invitation_back()}</a>
        {/if}
      </div>
    {/if}
  </div>
</section>
