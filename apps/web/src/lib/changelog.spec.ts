import { describe, expect, it } from 'vitest';
import { PAGE_SIZE, releaseHref, releasePage, releases } from './changelog';

describe('release history', () => {
  it('keeps each day together after filtering and before pagination', () => {
    const data = releasePage('fixed', null);
    expect(data.entries.length).toBeGreaterThan(0);
    expect(
      data.entries.every((entry) => entry.changes.every((change) => change.kind === 'fixed')),
    ).toBe(true);
    expect(data.entries.every((entry) => entry.changes.length > 0)).toBe(true);
    expect(releasePage(null, '2').entries[0]).toEqual(releases[PAGE_SIZE]);
  });

  it('shares the page containing a day, even when it is in the older history', () => {
    expect(releaseHref(releases[0].date)).toBe(`/novidades#${releases[0].date}`);
    expect(releaseHref(releases[PAGE_SIZE].date)).toBe(
      `/novidades?page=2#${releases[PAGE_SIZE].date}`,
    );
  });

  it('falls back for invalid filters and page numbers', () => {
    for (const input of ['-1', '0', '1.5', '2x', 'Infinity'])
      expect(releasePage('unknown', input).page).toBe(1);
    expect(releasePage('unknown', '1').kind).toBeNull();
    expect(releasePage(null, '999').page).toBeGreaterThan(releasePage(null, '999').pages);
  });

  it('has one entry per release day, newest first, with no repeated changes', () => {
    expect(new Set(releases.map((entry) => entry.date)).size).toBe(releases.length);
    expect(releases.map((entry) => entry.date)).toEqual(
      releases
        .map((entry) => entry.date)
        .sort()
        .reverse(),
    );
    for (const entry of releases)
      expect(new Set(entry.changes.map((change) => change.title)).size).toBe(entry.changes.length);
  });
});
