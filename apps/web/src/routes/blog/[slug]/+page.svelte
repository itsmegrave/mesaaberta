<script lang="ts">
  import { resolve } from '$app/paths';
  import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import Prose from '#lib/components/ui/Prose.svelte';
  import RichText from '#lib/components/ui/RichText.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import PostTags from '../components/PostTags.svelte';
  import PostMeta from '../components/PostMeta.svelte';

  let { data } = $props();
  const post = $derived(data.post);
</script>

<svelte:head>
  <link
    rel="alternate"
    type="application/rss+xml"
    title={m.blog_feed_title()}
    href="/blog/rss.xml"
  />
  <meta property="article:published_time" content={post.date} />
</svelte:head>

<article class="mx-auto max-w-prose py-6 md:py-8" aria-labelledby="post-title">
  <Breadcrumbs
    class="mb-6 md:mb-10"
    items={[{ label: m.blog_title(), href: resolve('/blog') }, { label: post.title }]}
  />
  <header>
    <h1
      id="post-title"
      class="text-3xl leading-tight font-semibold tracking-tight text-balance md:text-5xl"
    >
      {post.title}
    </h1>
    <p class="mt-3 leading-relaxed text-muted md:text-lg">{post.summary}</p>
    <PostMeta {post} class="mt-4 border-b border-surface-200-800 pb-4" />
  </header>
  <Prose class="mt-6 md:mt-8">
    <RichText html={post.html} />
  </Prose>
  <footer class="mt-10 flex flex-col gap-4 border-t border-surface-200-800 pt-6">
    <PostTags tags={post.tags} />
    <a
      href={resolve('/blog')}
      class="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-link underline underline-offset-4"
      ><Icon name="arrow-left" size={16} />{m.blog_back()}</a
    >
  </footer>
</article>
