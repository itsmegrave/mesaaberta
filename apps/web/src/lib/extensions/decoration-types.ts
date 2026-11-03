import type { Component, Snippet } from 'svelte';

// Kept out of `panels.ts`, which a private build replaces whole: these types stay the same there.

/**
 * What an avatar decoration's component is given (see `PersonAvatar`): its `data`, the avatar's
 * size in pixels, and the avatar itself to draw around. It must keep that size in the layout.
 */
export type AvatarDecorationProps = {
  data: Record<string, unknown>;
  size: number;
  children: Snippet;
};

/** What a profile decoration's component is given (see `ProfileDecoration`, on `/u/<username>`). */
export type ProfileDecorationProps = { data: Record<string, unknown>; username: string };

export type DecorationComponent =
  Component<AvatarDecorationProps> | Component<ProfileDecorationProps>;
