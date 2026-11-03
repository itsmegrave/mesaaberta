<script lang="ts">
  import type { Component } from 'svelte';
  import type { AvatarDecorationProps } from '#lib/extensions/decoration-types.js';
  import { loadDecoration } from '#lib/extensions/load-decoration.js';
  import MAAvatar from './ui/MAAvatar.svelte';
  import { personDecorations } from './decorations.svelte';

  type Size = 24 | 28 | 32 | 36 | 40 | 44 | 48 | 56 | 64 | 80 | 96 | 120 | 128;

  interface Props {
    /** Whose avatar: an extension may draw around it (a supporter's frame). */
    username: string | null | undefined;
    src?: string | null;
    name?: string | null;
    size?: Size;
    class?: string;
  }

  let { username, src = null, name = null, size = 36, class: className = '' }: Props = $props();

  const decorations = personDecorations(() => username);
  const avatar = $derived(decorations.current?.avatar);
</script>

{#snippet plain()}
  <MAAvatar {src} name={name ?? username} {size} class={className} />
{/snippet}

<!-- A person's avatar, with what an installed extension draws around it. Until the decoration
     arrives, or when there is none, it is the plain avatar, at the same size. -->
{#if avatar}
  {#await loadDecoration<AvatarDecorationProps>(avatar.kind)}
    {@render plain()}
  {:then Frame}
    {#if Frame}
      {@const Drawn = Frame as Component<AvatarDecorationProps>}
      <Drawn data={avatar.data} {size}>{@render plain()}</Drawn>
    {:else}
      {@render plain()}
    {/if}
  {:catch}
    {@render plain()}
  {/await}
{:else}
  {@render plain()}
{/if}
