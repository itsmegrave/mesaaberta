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
  let {
    site,
    directories = { systems: false, gms: false, places: false },
    blogLive = false,
  }: {
    site: { CONTACT_EMAIL: string; INSTAGRAM_HANDLE?: string };
    /** Which directories are on for the person: each one's link shows only then. */
    directories?: { systems: boolean; gms: boolean; places: boolean; players?: boolean };
    /** Whether a blog post is out: the Blog link shows only then. */
    blogLive?: boolean;
  } = $props();

  // `route` is the list's route id (its group included), `items` where the section's own pages
  // live under its letter (`/t/<slug>`). The directories follow, each while it is on.
  const sections = [
    { route: '/(tables)/tables', path: '/tables', items: '/t', label: m.nav_tables },
    { route: '/(partners)/partners', path: '/partners', items: '/p', label: m.partner_nav_label },
    {
      route: '/crowdfunding',
      path: '/crowdfunding',
      items: undefined,
      label: m.nav_crowdfunding_label,
    },
  ] as const;

  const pages = $derived([
    ...sections,
    ...(directories.systems
      ? [
          {
            route: '/systems',
            path: '/systems',
            items: '/s',
            label: m.directory_footer_systems,
          } as const,
        ]
      : []),
    ...(directories.places
      ? [
          {
            route: '/(places)/places',
            path: '/places',
            items: '/pp',
            label: m.directory_footer_places,
          } as const,
        ]
      : []),
    ...(directories.gms
      ? [
          {
            route: '/gamemasters',
            path: '/gamemasters',
            items: undefined,
            label: m.directory_footer_gms,
          } as const,
        ]
      : []),
    ...(directories.players
      ? [
          {
            route: '/players',
            path: '/players',
            items: undefined,
            label: m.directory_footer_players,
          } as const,
        ]
      : []),
  ]);

  const current = (path: string, items?: string) =>
    isUnder(page.url.pathname, path) || (!!items && isUnder(page.url.pathname, items));

  // Links inside sentences carry the primary underline; page links are quiet until hovered, and the
  // page you are on reads in ink with the same underline.
  const strong = 'link-underline text-surface-950-50';
</script>

<footer class="border-t border-surface-200-800 bg-panel pb-24 md:pb-0">
  <div class="mx-auto w-full max-w-7xl px-5 md:px-8">
    <div
      class="grid grid-cols-1 gap-4 pt-6 pb-3 sm:grid-cols-2 md:grid-cols-12 md:gap-8 md:pt-8 md:pb-5"
    >
      <div class="flex flex-col gap-1 sm:col-span-2 md:col-span-6 md:gap-2">
        <p class="flex items-center gap-3 text-surface-950-50">
          <TableLogo size={32} />
          <span class="font-brand text-xl font-semibold tracking-wider">Mesa Aberta</span>
        </p>
        <p class="max-w-sm text-sm leading-relaxed text-muted">
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

      <div class="flex flex-col gap-0 md:col-span-3 md:gap-2">
        <h2 class="text-sm font-semibold text-surface-950-50">{m.footer_pages()}</h2>
        <ul class="flex flex-wrap gap-x-5 text-sm md:gap-x-4 md:gap-y-1">
          {#each pages as item (item.path)}
            {@const here = current(item.path, item.items)}
            <li>
              <a
                href={resolve(item.route)}
                aria-current={here ? 'page' : undefined}
                class="inline-flex min-h-11 items-center md:min-h-0 {here
                  ? strong
                  : 'text-muted hover:text-surface-950-50'}">{item.label()}</a
              >
            </li>
          {/each}
        </ul>
      </div>

      <div class="flex flex-col gap-1 md:col-span-3 md:gap-2">
        <h2 class="text-sm font-semibold text-surface-950-50">{m.footer_support()}</h2>
        <a
          href={resolve('/changelog')}
          aria-current={current('/changelog') ? 'page' : undefined}
          class="inline-flex min-h-11 items-center text-sm text-muted hover:text-surface-950-50 md:min-h-0"
          >{m.changelog_title()}</a
        >
        {#if blogLive}<a
            href={resolve('/blog')}
            aria-current={current('/blog') ? 'page' : undefined}
            class="inline-flex min-h-11 items-center text-sm text-muted hover:text-surface-950-50 md:min-h-0"
            >{m.blog_title()}</a
          >{/if}
        <p class="text-sm leading-relaxed text-muted">
          {m.footer_help()}
          <a href="mailto:{site.CONTACT_EMAIL}" class="{strong} whitespace-nowrap"
            >{site.CONTACT_EMAIL}</a
          >.
        </p>
      </div>
    </div>

    <div
      class="flex flex-col gap-1 border-t border-surface-200-800 py-3 text-sm leading-relaxed text-muted md:flex-row md:items-center md:justify-between md:gap-8"
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
