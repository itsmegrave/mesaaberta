import { describe, expect, it } from 'vitest';
import { directoryNav } from './directory-nav';

const off = { systems: false, gms: false, places: false };

describe('directoryNav', () => {
  it('lists the directories whose flag is on, in the menus order, then Financiamentos and Ferramentas', () => {
    expect(directoryNav(off).map((link) => link.href)).toEqual(['/crowdfunding', '/tools']);
    expect(directoryNav({ ...off, systems: true }).map((link) => link.href)).toEqual([
      '/systems',
      '/crowdfunding',
      '/tools',
    ]);
    expect(directoryNav({ ...off, systems: true, gms: true }).map((link) => link.href)).toEqual([
      '/systems',
      '/gamemasters',
      '/crowdfunding',
      '/tools',
    ]);
    expect(
      directoryNav({ systems: true, gms: true, places: true }).map((link) => link.href),
    ).toEqual(['/systems', '/places', '/gamemasters', '/crowdfunding', '/tools']);
  });

  it('drops Procuro mesa while Combinar is on, and never lists Combinar (it is in the main menu)', () => {
    const hrefs = (switches: Parameters<typeof directoryNav>[0]) =>
      directoryNav(switches).map((link) => link.href);
    expect(hrefs({ ...off, players: true })).toEqual(['/players', '/crowdfunding', '/tools']);
    expect(hrefs({ ...off, players: true, matches: true })).toEqual(['/crowdfunding', '/tools']);
  });

  it('marks Financiamentos current on its list and its pages', () => {
    const crowdfunding = directoryNav(off).at(-2)!;
    expect(crowdfunding.current('/crowdfunding')).toBe(true);
    expect(crowdfunding.current('/crowdfunding/new')).toBe(true);
    expect(crowdfunding.current('/crowdfundings')).toBe(false);
  });

  it('marks Ferramentas current on its list and its form', () => {
    const tools = directoryNav(off).at(-1)!;
    expect(tools.current('/tools')).toBe(true);
    expect(tools.current('/tools/new')).toBe(true);
    expect(tools.current('/toolsx')).toBe(false);
    expect(tools.current('/crowdfunding')).toBe(false);
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
