import { describe, expect, it } from 'vitest';
import { directoryNav } from './directory-nav';

const off = { systems: false, gms: false, places: false };

describe('directoryNav', () => {
  it('lists only the directories whose flag is on, in the menus order', () => {
    expect(directoryNav(off)).toEqual([]);
    expect(directoryNav({ ...off, systems: true }).map((link) => link.href)).toEqual(['/systems']);
    expect(directoryNav({ ...off, systems: true, gms: true }).map((link) => link.href)).toEqual([
      '/systems',
      '/gamemasters',
    ]);
    expect(
      directoryNav({ systems: true, gms: true, places: true }).map((link) => link.href),
    ).toEqual(['/systems', '/places', '/gamemasters']);
  });

  it('marks Sistemas current on its list and on a system page, not on a longer name', () => {
    const [systems] = directoryNav({ ...off, systems: true });
    expect(systems.current('/systems')).toBe(true);
    expect(systems.current('/s/tormenta-20')).toBe(true);
    expect(systems.current('/settings')).toBe(false);
    expect(systems.current('/tables')).toBe(false);
  });

  it('marks Onde jogar current on its list and on a place page', () => {
    const [places] = directoryNav({ ...off, places: true });
    expect(places.current('/places')).toBe(true);
    expect(places.current('/pp/taverna-do-dado')).toBe(true);
    expect(places.current('/pp/new')).toBe(true);
    expect(places.current('/p/loja')).toBe(false);
    expect(places.current('/partners')).toBe(false);
  });

  it('marks Quem mestra current on its list only', () => {
    const [gms] = directoryNav({ ...off, gms: true });
    expect(gms.current('/gamemasters')).toBe(true);
    expect(gms.current('/games')).toBe(false);
    expect(gms.current('/u/ana')).toBe(false);
  });
});
