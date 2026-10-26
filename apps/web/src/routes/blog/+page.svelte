<script lang="ts">
  import { resolve } from '$app/paths';
  import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';
  import EmptyState from '#lib/components/ui/EmptyState.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import Pager from '#lib/components/ui/Pager.svelte';
  import { blogHref } from '#lib/blog.js';
  import { m } from '#lib/paraglide/messages.js';
  import PostTags from './components/PostTags.svelte';
  import PostMeta from './components/PostMeta.svelte';

  let { data } = $props();
</script>

<svelte:head>
  <link
    rel="alternate"
    type="application/rss+xml"
    title={m.blog_feed_title()}
    href="/blog/rss.xml"
  />
</svelte:head>

<div class="mx-auto max-w-3xl py-6 md:py-12">
  <Breadcrumbs class="mb-2 md:mb-10" items={[{ label: m.blog_title() }]} />
  <header class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-8">
    <div>
      <h1 class="text-4xl leading-tight font-semibold tracking-tight text-balance md:text-6xl">
        {m.blog_title()}
      </h1>
      <p class="mt-3 max-w-2xl leading-relaxed text-muted md:text-lg">{m.blog_lede()}</p>
    </div>
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- a feed file, not a page -->
    <a
      href="/blog/rss.xml"
      class="inline-flex min-h-11 shrink-0 items-center gap-2 self-start text-sm font-semibold text-link underline underline-offset-4 md:self-auto"
      ><Icon name="feed" size={16} />{m.blog_feed()}</a
    >
  </header>

  {#if !data.posts.length}
    <EmptyState text={m.blog_empty()} />
  {:else}
    <ol class="mt-6 flex flex-col gap-4 md:mt-10 md:gap-6">
      {#each data.posts as post (post.slug)}
        <li>
          <article
            aria-labelledby="{post.slug}-title"
            class="relative rounded-lg border border-surface-200-800 bg-panel px-4 py-5 md:p-6"
          >
            <PostMeta {post} />
            <h2
              id="{post.slug}-title"
              class="mt-2 text-xl leading-tight font-semibold tracking-tight text-balance md:text-2xl"
            >
              <!-- The whole card is the link's target; the author link sits above it. -->
              <a
                href={resolve('/blog/[slug]', { slug: post.slug })}
                class="after:absolute after:inset-0 after:rounded-lg hover:underline"
                >{post.title}</a
              >
            </h2>
            <p class="mt-2 leading-relaxed text-muted">{post.summary}</p>
            <PostTags tags={post.tags} class="mt-3" />
          </article>
        </li>
      {/each}
    </ol>
    <Pager compact class="mt-8" page={data.page} pages={data.pages} href={blogHref} />
  {/if}
</div>
