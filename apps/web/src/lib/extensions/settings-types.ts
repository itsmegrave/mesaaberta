import type { Component } from 'svelte';
import type { SettingsCard } from '@mesaaberta/core/server/extensions/contract';

// Kept out of `panels.ts`, which a private build replaces whole: these types stay the same there.

/** What an extension's card on "Editar perfil › Perfil público" is given. */
export type SettingsProps = {
  card: SettingsCard;
  /** Where its form posts (a SvelteKit action of the page, with the extension in the query). */
  action: string;
  /** The person's avatar as the page draws it, for a card that previews something on it. */
  avatar: { src: string | null; name: string };
};
export type SettingsComponent = Component<SettingsProps>;
