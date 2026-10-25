<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import Icon from '#lib/components/ui/Icon.svelte';
  import TableLogo from '#lib/components/ui/TableLogo.svelte';
  import { footerNotes } from '#lib/extensions/panels.js';
  import { isUnder } from '#lib/navigation/main-nav.js';
  import { m } from '#lib/paraglide/messages.js';

  // The site footer: the brand with the community sentence (and any notes a private build adds),
  // the pages and the contact, then a bottom bar with the open-source sentence and the credits.
  let { site }: { site: { CONTACT_EMAIL: string; INSTAGRAM_HANDLE?: string } } = $props();

  const pages = [
    { path: '/t', label: m.nav_tables },
    { path: '/p', label: m.partner_nav_label },
    { path: '/cf', label: m.nav_crowdfunding_label },
  ] as const;

  const current = (path: string) => isUnder(page.url.pathname, path);

  // Links inside sentences carry the primary underline; page links are quiet until hovered, and the
  // page you are on reads in ink with the same underline.
  const strong = 'link-underline text-surface-950-50';
</script>

<footer class="border-t border-surface-200-800 bg-panel pb-24 md:pb-0">
  <div class="mx-auto w-full max-w-7xl px-5 md:px-8">
    <div class="grid grid-cols-1 gap-7 pt-8 pb-6 sm:grid-cols-2 md:grid-cols-12 md:gap-8 md:py-14">
      <div class="flex flex-col gap-3 sm:col-span-2 md:col-span-6 md:gap-5">
        <p class="flex items-center gap-3 text-surface-950-50">
          <TableLogo size={48} />
          <span class="font-brand text-2xl font-semibold tracking-wider md:text-3xl"
            >Mesa Aberta</span
          >
        </p>
        <p class="max-w-sm text-base leading-relaxed text-muted">
          {m.footer_community()}
          {#each footerNotes as note (note.text)}
            {note.text}
            {#if note.link}
              <a href={note.link.href} rel="noopener" target="_blank" class={strong}
                >{note.link.label}</a
              >.
            {/if}
          {/each}
        </p>
        {#if site.INSTAGRAM_HANDLE}
          <!-- eslint-disable svelte/no-navigation-without-resolve -- Instagram is an external website, not an app route -->
          <a
            href="https://www.instagram.com/{site.INSTAGRAM_HANDLE}/"
            rel="noopener"
            target="_blank"
            aria-label={m.footer_instagram_label({ handle: site.INSTAGRAM_HANDLE })}
            title="@{site.INSTAGRAM_HANDLE}"
            class="-mb-2 -ml-3 inline-flex size-11 items-center justify-center rounded-full text-surface-950-50 hover:preset-tonal"
          >
            <Icon name="brand:instagram" size={22} />
          </a>
          <!-- eslint-enable svelte/no-navigation-without-resolve -->
        {/if}
      </div>

      <div class="flex flex-col gap-0 md:col-span-3 md:gap-4">
        <h2 class="text-sm font-semibold text-surface-950-50">{m.footer_pages()}</h2>
        <ul class="flex flex-wrap gap-x-5 text-sm md:flex-col md:gap-3">
          {#each pages as item (item.path)}
            <li>
              <a
                href={resolve(item.path)}
                aria-current={current(item.path) ? 'page' : undefined}
                class="inline-flex min-h-11 items-center md:min-h-0 {current(item.path)
                  ? strong
                  : 'text-muted hover:text-surface-950-50'}">{item.label()}</a
              >
            </li>
          {/each}
        </ul>
      </div>

      <div class="flex flex-col gap-2 md:col-span-3 md:gap-4">
        <h2 class="text-sm font-semibold text-surface-950-50">{m.footer_support()}</h2>
        <p class="text-sm leading-relaxed text-muted">
          {m.footer_help()}
          <a href="mailto:{site.CONTACT_EMAIL}" class="{strong} whitespace-nowrap"
            >{site.CONTACT_EMAIL}</a
          >.
        </p>
      </div>
    </div>

    <div
      class="flex flex-col gap-2 border-t border-surface-200-800 py-5 text-sm leading-relaxed text-muted md:flex-row md:items-center md:justify-between md:gap-8 md:py-6"
    >
      <p>
        {m.footer_open_source()}
        <a
          href="https://github.com/itsmegrave/mesaaberta"
          rel="noopener"
          target="_blank"
          class={strong}>GitHub</a
        >.
      </p>
      <p class="shrink-0">
        {m.footer_made_with()}
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          role="img"
          aria-label={m.footer_made_with_love()}
          class="inline shrink-0 fill-none stroke-secondary-300 align-middle"
          stroke-width="2"
        >
          <path
            d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 6.9 4.5c2 0 3.6 1.1 4.6 2.7h1c1-1.6 2.6-2.7 4.6-2.7 3.5 0 5.5 3.5 4.2 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"
          ></path>
        </svg>
        {m.footer_made_by()}
        <a href="https://github.com/itsmegrave" rel="noopener" target="_blank" class={strong}
          >itsmegrave</a
        >.
      </p>
    </div>
  </div>
</footer>
