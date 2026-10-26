<script lang="ts">
  // "Seguindo": the two bell switches for the people this person follows, how many follow them,
  // and the people they follow, each with "Deixar de seguir". Nobody else sees any of it.
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import MAForm from '#lib/components/ui/MAForm.svelte';
  import MAAvatar from '#lib/components/ui/MAAvatar.svelte';
  import Pager from '#lib/components/ui/Pager.svelte';
  import FollowButton from '#lib/components/FollowButton.svelte';
  import SettingsSection from '../components/ui/SettingsSection.svelte';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import { fromResult } from '#lib/forms/contract.js';
  import { pageHref } from '#lib/admin/page-href.js';
  import { toast } from '#lib/toaster.js';
  import { atHandle } from '@mesaaberta/core/profile/handle';
  import { followNoticesSchema } from '@mesaaberta/core/follows/schema';
  import { m } from '#lib/paraglide/messages.js';

  let { data, form: result = null } = $props();

  // svelte-ignore state_referenced_locally
  const notices = actionForm({
    ...fromResult(
      result?.form && 'tables' in result.form.data
        ? (result.form as typeof data.noticesForm)
        : data.noticesForm,
    ),
    schema: followNoticesSchema,
    refresh: false,
    domain: 'account',
    onSuccess: () => {
      notices.markSaved();
      toast.success(m.follow_notices_saved());
    },
    errorMessage: m.follow_notices_failed,
  });
  const { draft } = notices;

  const card = 'rounded-lg border border-surface-200-800 bg-panel p-6 md:p-8';
  const heading = 'text-2xl leading-tight font-semibold tracking-tight';
</script>

<SettingsSection title={m.profile_section_following()} lede={m.profile_section_following_lede()} />

<section aria-labelledby="follow-notices" class={card}>
  <MAForm action="?/notices" onsubmit={notices.submit}>
    <fieldset>
      <legend id="follow-notices" class={heading}>{m.follow_notices_title()}</legend>
      <div class="mt-3 grid gap-1">
        <label class="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            name="tables"
            value="true"
            bind:checked={$draft.tables}
            class="checkbox"
          />
          {m.follow_notices_tables()}
        </label>
        <label class="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            name="seats"
            value="true"
            bind:checked={$draft.seats}
            class="checkbox"
          />
          {m.follow_notices_seats()}
        </label>
      </div>
    </fieldset>
    {#if notices.errors._errors?.[0]}
      <p role="alert" class="mt-3 text-sm font-semibold text-error-700-300">
        {notices.errors._errors[0]}
      </p>
    {/if}
    <MAButton
      type="submit"
      variant="secondary"
      size="sm"
      controller={notices}
      class="mt-4 font-semibold"
    >
      {m.follow_notices_save()}
    </MAButton>
  </MAForm>
</section>

<section aria-labelledby="following-list" class={card}>
  <div class="flex flex-wrap items-baseline justify-between gap-3">
    <h3 id="following-list" class={heading}>
      {m.follow_following_count({ count: data.following.total })}
    </h3>
    <span class="text-sm text-muted">{m.follow_followers_count({ count: data.followers })}</span>
  </div>

  {#if data.following.total === 0}
    <p class="mt-3 max-w-prose text-muted">{m.follow_following_empty()}</p>
  {:else}
    <ul aria-label={m.follow_following_label()} class="mt-2 divide-y divide-surface-200-800">
      {#each data.following.people as person (person.id)}
        <li class="flex flex-wrap items-center gap-3 py-3.5">
          <MAAvatar src={person.avatarUrl} name={person.username} size={44} />
          <div class="min-w-0 flex-1">
            <a
              href="/u/{encodeURIComponent(person.username)}"
              class="font-semibold text-surface-950-50 no-underline hover:underline"
              >{person.name ?? atHandle(person.username)}</a
            >
            <p class="text-sm text-muted">
              {#if person.name}{atHandle(person.username)} ·
              {/if}{m.follow_open_tables({ count: person.openTables })}
            </p>
          </div>
          <FollowButton
            size="sm"
            profileId={person.id}
            username={person.username}
            following
            label={m.follow_stop()}
          />
        </li>
      {/each}
    </ul>
    {#if data.following.pages > 1}
      <Pager
        compact
        class="mt-4"
        page={data.following.page}
        pages={data.following.pages}
        href={(number) => pageHref('/u/profile/edit/following', new URLSearchParams(), number)}
      />
    {/if}
  {/if}
</section>
