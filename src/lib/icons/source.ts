// Read by `scripts/icons.ts` and the test that keeps the generated module fresh; never by the app,
// which would bundle the whole Lucide set.
import { icons as lucide } from '@iconify-json/lucide';
import { getIconData } from '@iconify/utils';
import type { IconifyIcon } from '@iconify/types';

/** Each named Lucide icon's drawing, with its size. Throws for a name Lucide does not have. */
export function iconData(names: readonly string[]): Record<string, IconifyIcon> {
  return Object.fromEntries(
    names.map((name) => {
      const data = getIconData(lucide, name);
      if (!data) throw new Error(`Lucide has no icon named "${name}"`);
      return [name, { body: data.body, width: data.width, height: data.height }];
    }),
  );
}
