<script lang="ts">
  import { resolve } from '$app/paths';
  import Pill from '#lib/components/ui/Pill.svelte';
  import { isPublished, type PostMeta } from '#lib/blog.js';
  import { getLocale } from '#lib/paraglide/runtime.js';
  import { m } from '#lib/paraglide/messages.js';

  /** A post's line of facts: the day, who wrote it, how long it takes to read, and its state for admins. */
  let { post, class: className = '' }: { post: PostMeta; class?: string } = $props();

  const day = $derived(
    new Intl.DateTimeFormat(getLocale(), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${post.date}T12:00:00Z`)),
  );
  // Only admins are sent drafts and scheduled posts, so the label never shows to anyone else.
  const state = $derived(
    isPublished(post) ? null : post.draft ? m.blog_draft() : m.blog_scheduled(),
  );
</script>

<p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted {className}">
  {#if state}<Pill tone="warning">{state}</Pill>{/if}
  <time datetime={post.date} class="font-semibold">{day}</time>
  <span aria-hidden="true">·</span>
  <a
    href={resolve('/u/[username]', { username: post.author })}
    class="relative z-10 inline-flex min-h-11 items-center hover:underline md:min-h-0"
    >@{post.author}</a
  >
  <span aria-hidden="true">·</span>
  <span>{m.blog_minutes({ minutes: post.minutes })}</span>
</p>
