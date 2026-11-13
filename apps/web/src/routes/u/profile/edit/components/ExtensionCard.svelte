<script lang="ts">
  // One installed extension's card on "Perfil público" (a supporter's avatar frame), drawn by the
  // extension's own component. A component that fails to load draws nothing.
  import type { SettingsCard } from '@mesaaberta/core/server/extensions/contract';
  import { settings } from '#lib/extensions/panels.js';
  import type { SettingsProps } from '#lib/extensions/settings-types.js';

  let { ext, card, avatar }: { ext: string; card: SettingsCard; avatar: SettingsProps['avatar'] } =
    $props();

  const component = $derived(
    Object.hasOwn(settings, card.kind)
      ? settings[card.kind]().then(
          (loaded) => loaded.default,
          async (failure: unknown) => {
            console.error('extension.load_failed', {
              resourceType: 'settings',
              resourceId: card.kind,
            });
            // `@sentry/core`, not the SDK: a dynamic import keeps every export (Replay too).
            const Sentry = await import('@sentry/core');
            Sentry.captureException(failure, {
              tags: { resourceType: 'settings', resourceId: card.kind },
            });
            return null;
          },
        )
      : Promise.resolve(null),
  );
</script>

{#await component then Card}
  {#if Card}
    <Card {card} {avatar} action="?/extension&ext={encodeURIComponent(ext)}" />
  {/if}
{/await}
