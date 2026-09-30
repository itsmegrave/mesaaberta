<script lang="ts">
  import Avatar from '$lib/components/Avatar.svelte';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { getLocale } from '$lib/paraglide/runtime';
  import { m } from '$lib/paraglide/messages';

  let { data } = $props();
  const locale = getLocale();
  const date = (value: Date) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: data.viewer.timezone,
    }).format(value);
  const details = $derived([
    [m.admin_profile_id(), data.user.id],
    [m.admin_profile_username(), data.user.username ?? m.admin_profile_no_username()],
    [m.admin_user_name(), data.user.name ?? m.admin_user_unset()],
    [
      m.admin_profile_status(),
      data.user.status === 'active' ? m.admin_profile_active() : m.admin_profile_suspended(),
    ],
    [m.admin_user_city(), data.user.city ?? m.admin_user_unset()],
    [m.admin_user_timezone(), data.user.timezone ?? m.admin_user_unset()],
    [m.admin_user_created(), date(data.user.createdAt)],
    [m.admin_user_updated(), date(data.user.updatedAt)],
  ]);
</script>

<svelte:head><title>{data.user.username ?? m.admin_user_title()} | Mesa Aberta</title></svelte:head>
<section class="py-6 md:py-10">
  <Breadcrumbs
    items={[{ label: m.nav_admin(), href: '/admin' }, { label: m.admin_user_title() }]}
    class="mb-6"
  />
  <a class="inline-flex min-h-11 items-center gap-2 anchor" href={localizedHref(data.back, locale)}
    ><Icon name="chevron-left" />{m.admin_user_back()}</a
  >
  <div class="mt-6 flex items-center gap-4">
    <Avatar
      src={data.avatar}
      name={data.user.name ?? data.user.username ?? m.admin_user_title()}
      size={64}
    />
    <div class="min-w-0">
      <h1 class="text-2xl font-semibold wrap-break-word">
        {data.user.username ? `@${data.user.username}` : m.admin_profile_no_username()}
      </h1>
      <p class="mt-1 text-sm text-muted">{m.admin_user_title()}</p>
    </div>
  </div>
  <dl class="mt-8 max-w-3xl divide-y divide-surface-200-800 border-y border-surface-200-800">
    {#each details as [label, value] (label)}
      <div class="grid gap-2 py-4 sm:grid-cols-2">
        <dt class="text-sm font-semibold text-muted">{label}</dt>
        <dd class="text-sm break-all">{value}</dd>
      </div>
    {/each}
  </dl>
</section>
