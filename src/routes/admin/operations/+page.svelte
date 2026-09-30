<script lang="ts">
  import { defaults, superForm } from 'sveltekit-superforms';
  import { zod4 } from 'sveltekit-superforms/adapters';
  import { z } from 'zod';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import { toast } from '$lib/toaster';

  let { data } = $props();

  const locale = getLocale();
  const number = new Intl.NumberFormat(locale);
  const seconds = (total: number) =>
    total < 60
      ? m.admin_ops_age_seconds({ count: total })
      : total < 3600
        ? m.admin_ops_age_minutes({ count: Math.floor(total / 60) })
        : total < 86400
          ? m.admin_ops_age_hours({ count: Math.floor(total / 3600) })
          : m.admin_ops_age_days({ count: Math.floor(total / 86400) });
  const age = (from: Date) => seconds(Math.max(0, Math.round((+data.now - +from) / 1000)));

  const retrySchema = z.object({ id: z.uuid() });
  // One form for the page: the id of the row is what is posted.
  const retry = superForm(defaults({ id: '' }, zod4(retrySchema)), {
    id: 'retry',
    resetForm: false,
    onUpdated: ({ form }) => {
      if (form.valid) toast.success(m.admin_ops_retry_done());
    },
  });
  const { errors, enhance, submitting, delayed, timeout } = retry;

  const tile = 'rounded-lg border border-surface-200-800 bg-panel p-5';
</script>

<svelte:head><title>{m.admin_ops_title()}</title></svelte:head>

<section class="pt-8 pb-4">
  <h1 class="text-4xl leading-none font-semibold tracking-tight text-balance md:text-6xl">
    {m.admin_ops_title()}
  </h1>
  <p class="mt-4 max-w-2xl text-lg">{m.admin_ops_lede()}</p>
  {#if !data.canRetry}
    <p role="note" class="mt-3 text-sm font-semibold text-muted">{m.admin_ops_readonly()}</p>
  {/if}

  <dl class="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
    <div class={tile}>
      <dt class="text-sm text-muted">{m.admin_ops_pending()}</dt>
      <dd class="mt-1 text-3xl font-semibold tabular-nums">{number.format(data.health.pending)}</dd>
    </div>
    <div class={tile}>
      <dt class="text-sm text-muted">{m.admin_ops_retrying()}</dt>
      <dd class="mt-1 text-3xl font-semibold tabular-nums">
        {number.format(data.health.retrying)}
      </dd>
    </div>
    <div class={tile}>
      <dt class="text-sm text-muted">{m.admin_ops_failed()}</dt>
      <dd class="mt-1 text-3xl font-semibold tabular-nums">{number.format(data.health.failed)}</dd>
    </div>
    <div class={tile}>
      <dt class="text-sm text-muted">{m.admin_ops_oldest()}</dt>
      <dd class="mt-1 text-3xl font-semibold tabular-nums">
        {data.health.oldestPendingSeconds === null
          ? m.admin_ops_oldest_none()
          : seconds(data.health.oldestPendingSeconds)}
      </dd>
    </div>
  </dl>

  {#if data.health.byType.length > 0}
    <h2 class="mt-10 text-xl font-semibold">{m.admin_ops_by_type()}</h2>
    <ul class="mt-3 flex flex-wrap gap-2 text-sm">
      {#each data.health.byType as row (row.type)}
        <li class="rounded-full border border-surface-200-800 px-3 py-1">
          <span class="font-semibold">{row.type}</span>
          · {m.admin_ops_pending()}
          {row.pending} · {m.admin_ops_failed()}
          {row.failed}
        </li>
      {/each}
    </ul>
  {/if}

  <h2 class="mt-10 text-xl font-semibold">{m.admin_ops_work()}</h2>
  {#if data.work.length === 0}
    <p class="mt-3 rounded-lg border border-surface-200-800 bg-panel p-6" role="status">
      {m.admin_ops_empty()}
    </p>
  {:else}
    {#if $errors._errors?.[0]}
      <p role="alert" class="mt-3 text-sm font-semibold text-error-700-300">
        {m.admin_ops_retry_refused()}
      </p>
    {/if}
    <div class="mt-3 overflow-x-auto rounded-lg border border-surface-200-800">
      <table class="w-full min-w-208 text-left text-sm">
        <thead class="border-b border-surface-200-800 text-muted">
          <tr>
            <th scope="col" class="px-4 py-3 font-semibold">{m.admin_ops_col_event()}</th>
            <th scope="col" class="px-4 py-3 font-semibold">{m.admin_ops_col_state()}</th>
            <th scope="col" class="px-4 py-3 font-semibold">{m.admin_ops_col_age()}</th>
            <th scope="col" class="px-4 py-3 font-semibold">{m.admin_ops_col_attempts()}</th>
            <th scope="col" class="px-4 py-3 font-semibold">{m.admin_ops_col_done()}</th>
            <th scope="col" class="px-4 py-3 font-semibold">{m.admin_ops_col_error()}</th>
            {#if data.canRetry}
              <th scope="col" class="px-4 py-3 text-right font-semibold"
                >{m.admin_ops_col_actions()}</th
              >
            {/if}
          </tr>
        </thead>
        <tbody>
          {#each data.work as row (row.id)}
            <tr class="border-b border-surface-200-800 align-top last:border-b-0">
              <th scope="row" class="px-4 py-3 font-semibold">
                {row.type}
                <span class="block font-mono text-xs font-normal text-muted">{row.id}</span>
              </th>
              <td
                class="px-4 py-3 {row.state === 'failed' ? 'font-semibold text-error-700-300' : ''}"
              >
                {row.state === 'failed' ? m.admin_ops_state_failed() : m.admin_ops_state_pending()}
              </td>
              <td class="px-4 py-3">{age(row.createdAt)}</td>
              <td class="px-4 py-3 tabular-nums">
                {m.admin_ops_attempts({ attempts: row.attempts, max: row.maxAttempts })}
              </td>
              <td class="px-4 py-3">
                {row.handledBy.length > 0 ? row.handledBy.join(', ') : m.admin_ops_done_none()}
              </td>
              <td class="max-w-xs px-4 py-3 wrap-break-word">
                {row.lastError ?? m.admin_ops_error_none()}
              </td>
              {#if data.canRetry}
                <td class="px-4 py-3 text-right">
                  {#if row.state === 'failed'}
                    <form method="POST" action="?/retry" use:enhance>
                      <input type="hidden" name="id" value={row.id} />
                      <SubmitButton
                        submitting={$submitting}
                        delayed={$delayed}
                        timeout={$timeout}
                        class="btn h-12 rounded-lg border-2 border-surface-200-800 px-4 font-semibold hover:preset-tonal"
                        ><span aria-hidden="true">{m.admin_ops_retry()}</span><span class="sr-only"
                          >{m.admin_ops_retry_label({ type: row.type })}</span
                        ></SubmitButton
                      >
                    </form>
                  {/if}
                </td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>
