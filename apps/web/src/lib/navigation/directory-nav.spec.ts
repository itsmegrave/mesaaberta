import { describe, expect, it } from 'vitest';
import { directoryNav } from './directory-nav';

describe('directoryNav', () => {
  it('lists only the directories whose flag is on', () => {
    expect(directoryNav({ systems: false })).toEqual([]);
    expect(directoryNav({ systems: true }).map((link) => link.href)).toEqual(['/systems']);
  });

  it('marks Sistemas current on its list and on a system page, not on a longer name', () => {
    const [systems] = directoryNav({ systems: true });
    expect(systems.current('/systems')).toBe(true);
    expect(systems.current('/s/tormenta-20')).toBe(true);
    expect(systems.current('/settings')).toBe(false);
    expect(systems.current('/tables')).toBe(false);
  });
});
