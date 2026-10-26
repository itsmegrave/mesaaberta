import { describe, expect, it } from 'vitest';
import { directoryNav } from './directory-nav';

describe('directoryNav', () => {
  it('lists only the directories whose flag is on', () => {
    expect(directoryNav({ systems: false, gms: false })).toEqual([]);
    expect(directoryNav({ systems: true, gms: false }).map((link) => link.href)).toEqual([
      '/systems',
    ]);
    expect(directoryNav({ systems: true, gms: true }).map((link) => link.href)).toEqual([
      '/systems',
      '/gamemasters',
    ]);
  });

  it('marks Sistemas current on its list and on a system page, not on a longer name', () => {
    const [systems] = directoryNav({ systems: true, gms: false });
    expect(systems.current('/systems')).toBe(true);
    expect(systems.current('/s/tormenta-20')).toBe(true);
    expect(systems.current('/settings')).toBe(false);
    expect(systems.current('/tables')).toBe(false);
  });

  it('marks Quem mestra current on its list only', () => {
    const [gms] = directoryNav({ systems: false, gms: true });
    expect(gms.current('/gamemasters')).toBe(true);
    expect(gms.current('/games')).toBe(false);
    expect(gms.current('/u/ana')).toBe(false);
  });
});
