// Read by `scripts/icons.ts` and the test that keeps the generated module fresh; never by the app,
// which would bundle the whole icon collections.
import { icons as gameIcons } from '@iconify-json/game-icons';
import { icons as lucide } from '@iconify-json/lucide';
import { getIconData } from '@iconify/utils';
import type { IconifyIcon } from '@iconify/types';

/** Each listed icon's drawing, with its size. Throws if its collection lacks the name. */
export function iconData(names: readonly string[]): Record<string, IconifyIcon> {
  return Object.fromEntries(
    names.map((name) => {
      const gameIcon = name.startsWith('game-icons:');
      const data = getIconData(gameIcon ? gameIcons : lucide, gameIcon ? name.slice(11) : name);
      if (!data) throw new Error(`Icon collection has no icon named "${name}"`);
      return [name, { body: data.body, width: data.width, height: data.height }];
    }),
  );
}
