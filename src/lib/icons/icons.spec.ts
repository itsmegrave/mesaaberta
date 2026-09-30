import { describe, expect, it } from 'vitest';
import { ICONS } from './lucide.generated';
import { ICON_NAMES } from './names';
import { iconData } from './source';

describe('the bundled icons', () => {
  it('are exactly the listed ones, as Lucide draws them (run `pnpm icons` if not)', () => {
    expect(ICONS).toEqual(iconData(ICON_NAMES));
  });

  it('refuses a name Lucide does not have', () => {
    expect(() => iconData(['not-an-icon'])).toThrow(/not-an-icon/);
  });
});
