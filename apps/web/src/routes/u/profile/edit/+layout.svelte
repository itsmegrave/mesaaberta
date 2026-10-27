<script lang="ts">
  // "Editar perfil", in parts: the side menu (a "Seção" menu on a phone) and the part open now.
  import { page } from '$app/state';
  import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';
  import SettingsNav from './components/SettingsNav.svelte';
  import { atHandle } from '@mesaaberta/core/profile/handle';
  import { m } from '#lib/paraglide/messages.js';

  let { data, children } = $props();
</script>

<svelte:head>
  <title>{m.account_profile_title()} · Mesa Aberta</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<section class="pt-2 pb-4 md:pt-8">
  <Breadcrumbs
    class="mb-8"
    items={[
      ...(data.username ? [{ label: atHandle(data.username), href: `/u/${data.username}` }] : []),
      { label: m.nav_edit_profile() },
    ]}
  />
  <h1 class="text-3xl leading-none font-semibold tracking-tight text-balance md:text-5xl">
    {m.account_profile_title()}
  </h1>
  <p class="mt-2 max-w-md text-base text-muted md:mt-3 md:max-w-xl md:text-xl">
    {m.account_profile_lede()}
  </p>

  <div class="mt-6 grid gap-6 md:mt-8 md:flex md:items-start md:gap-7">
    <SettingsNav
      path={page.url.pathname}
      systems={data.systemsSection}
      following={data.followingSection}
    />
    <div class="grid min-w-0 flex-1 gap-6">
      {@render children()}
    </div>
  </div>
</section>
