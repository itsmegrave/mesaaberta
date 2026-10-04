<script lang="ts">
  import UserLink from '$lib/components/UserLink.svelte';
  import { dayLabel, timeLabel } from '$lib/admin/format';
  import { atHandle } from '$lib/profile/handle';
  import type { History, HistoryEntry } from '$lib/server/admin/history';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  /**
   * What happened to a table or a person, newest first: who did it, what, when, and for an edit
   * what changed. The same list on both admin pages; `showTable` names the table on each line, for
   * a person's history, where it is not obvious.
   */
  let {
    history,
    zone,
    showTable = false,
  }: { history: History; zone: string; showTable?: boolean } = $props();

  const locale = getLocale();

  const FIELDS: Record<string, () => string> = {
    title: m.history_field_title,
    description: m.history_field_description,
    extraInfo: m.history_field_extraInfo,
    welcomeMessage: m.history_field_welcomeMessage,
    kind: m.history_field_kind,
    capacity: m.history_field_capacity,
    minPlayers: m.history_field_minPlayers,
    startsAt: m.history_field_startsAt,
    durationMinutes: m.history_field_durationMinutes,
    timezone: m.history_field_timezone,
    recurrence: m.history_field_recurrence,
    until: m.history_field_until,
    joinMode: m.history_field_joinMode,
    modality: m.history_field_modality,
    locationArea: m.history_field_locationArea,
    joinDetails: m.history_field_joinDetails,
    postalCode: m.history_field_postalCode,
    locationNeighbourhood: m.history_field_locationNeighbourhood,
    locationCity: m.history_field_locationCity,
    locationState: m.history_field_locationState,
    system: m.history_field_system,
    platforms: m.history_field_platforms,
    tags: m.history_field_tags,
    image: m.history_field_image,
    username: m.history_field_username,
    name: m.history_field_name,
    ageRange: m.history_field_ageRange,
    gender: m.history_field_gender,
    genderOther: m.history_field_genderOther,
    city: m.history_field_city,
    links: m.history_field_links,
  };
  const fieldLabel = (field: string) => FIELDS[field]?.() ?? field;

  /** The words for the few values the record keeps as codes. */
  const WORDS: Record<string, Record<string, () => string>> = {
    kind: {
      campaign: m.table_kind_campaign,
      one_shot: m.table_kind_one_shot,
      adventure: m.table_kind_adventure,
    },
    modality: { online: m.table_modality_online, in_person: m.table_modality_in_person },
    joinMode: { auto: m.history_value_join_auto, approval: m.history_value_join_approval },
  };

  function show(field: string, value: string | number | boolean | null) {
    if (value === null) return m.history_value_empty();
    if ((field === 'startsAt' || field === 'until') && typeof value === 'string') {
      const date = new Date(value);
      return `${dayLabel(date, locale, zone)}, ${timeLabel(date, locale, zone)}`;
    }
    return WORDS[field]?.[String(value)]?.() ?? String(value);
  }

  /** What the person did, without who did it: that is shown in front, as a link. */
  function whatHappened(entry: HistoryEntry) {
    const user = atHandle(entry.subject);
    switch (entry.type) {
      case 'TableCreated':
        return m.history_event_TableCreated();
      case 'TableUpdated':
        return m.history_event_TableUpdated();
      case 'TableEdited':
        return m.history_event_TableEdited();
      case 'TableDisabled':
        return m.history_event_TableDisabled();
      case 'TableAwaitingConfirmation':
        return m.history_event_TableAwaitingConfirmation();
      case 'TableConcluded':
        return m.history_event_TableConcluded();
      case 'TableNotHeld':
        return m.history_event_TableNotHeld();
      case 'TableClosedByModeration':
        return m.history_event_TableClosedByModeration();
      case 'JoinRequested':
        return m.history_event_JoinRequested();
      case 'JoinApproved':
        return m.history_event_JoinApproved({ user });
      case 'JoinDeclined':
        return m.history_event_JoinDeclined({ user });
      case 'PlayerJoined':
        return m.history_event_PlayerJoined();
      case 'PlayerLeft':
        return entry.removed
          ? m.history_event_PlayerRemoved({ user })
          : m.history_event_PlayerLeft();
      case 'RatingSubmitted':
        return m.history_event_RatingSubmitted();
      case 'ProfileUpdated':
        return m.history_event_ProfileUpdated();
      case 'AccountBanned':
        return m.history_event_AccountBanned({ user });
      case 'AccountReinstated':
        return m.history_event_AccountReinstated({ user });
      case 'AccountBanLifted':
        return m.history_event_AccountBanLifted({ user });
      case 'ReportFiled':
        return m.history_event_ReportFiled();
      case 'ReportReviewing':
        return m.history_event_ReportReviewing();
      case 'ReportResolved':
        return m.history_event_ReportResolved();
      case 'ReportDismissed':
        return m.history_event_ReportDismissed();
      case 'SystemAnnouncementSent':
        return m.history_event_SystemAnnouncementSent();
      case 'CatalogEntryCreated':
      case 'CatalogEntryApproved':
      case 'CatalogEntryRejected':
      case 'CatalogEntryRenamed':
      case 'CatalogEntryMerged':
      case 'CatalogEntryDisabled':
        return m.history_event_CatalogEntry();
      default:
        return entry.type;
    }
  }

  /** An edit says what it changed; one recorded before the log kept that has nothing to show. */
  const isEdit = (entry: HistoryEntry) =>
    entry.type === 'TableUpdated' || entry.type === 'TableEdited';
</script>

{#if history.entries.length === 0}
  <p class="text-muted" role="status">{m.history_empty()}</p>
{:else}
  <ol class="divide-y divide-surface-200-800 rounded-lg border border-surface-200-800 bg-panel">
    {#each history.entries as entry (entry.id)}
      {@const changes = entry.changes ? Object.entries(entry.changes) : []}
      <li class="px-4 py-3">
        <p class="wrap-break-word">
          {#if entry.actor}
            <span class="font-semibold"
              ><UserLink
                username={entry.actor.username}
                label={atHandle(entry.actor.username)}
              /></span
            >
          {:else}
            <span class="font-semibold">{m.history_system()}</span>
          {/if}
          {whatHappened(entry)}
        </p>
        <p class="text-sm text-muted">
          <time datetime={entry.at.toISOString()} class="tabular-nums"
            >{dayLabel(entry.at, locale, zone)} · {timeLabel(entry.at, locale, zone)}</time
          >
          {#if showTable && entry.table}
            · {m.history_on_table({ table: entry.table })}
          {/if}
        </p>
        {#if changes.length > 0}
          <dl class="mt-2 grid gap-1 text-sm">
            {#each changes as [field, change] (field)}
              <div class="flex flex-wrap gap-x-2">
                <dt class="font-semibold">{fieldLabel(field)}:</dt>
                <dd class="min-w-0 wrap-break-word text-muted">
                  {#if 'redacted' in change}
                    {m.history_changed_hidden()}
                  {:else}
                    {m.history_arrow({
                      from: show(field, change.from),
                      to: show(field, change.to),
                    })}
                  {/if}
                </dd>
              </div>
            {/each}
          </dl>
        {:else if isEdit(entry)}
          <p class="mt-1 text-sm text-muted">{m.history_changed_none()}</p>
        {/if}
      </li>
    {/each}
  </ol>
  <p class="mt-2 text-sm text-muted">
    {#if history.more}{m.history_more({ count: history.entries.length })}
    {/if}{m.history_retention({ days: history.retentionDays })}
  </p>
{/if}
