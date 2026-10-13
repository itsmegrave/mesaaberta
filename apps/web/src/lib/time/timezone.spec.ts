import { describe, expect, it } from 'vitest';
import { DEFAULT_TIMEZONE, isTimeZone, timezoneOptions, viewerTimezone } from './timezone';

describe('isTimeZone', () => {
  it('accepts an IANA zone and refuses anything else', () => {
    expect(isTimeZone('America/Sao_Paulo')).toBe(true);
    expect(isTimeZone('Europe/Lisbon')).toBe(true);
    expect(isTimeZone('Mars/Olympus_Mons')).toBe(false);
    expect(isTimeZone('')).toBe(false);
    expect(isTimeZone(undefined)).toBe(false);
    expect(isTimeZone('x'.repeat(65))).toBe(false);
  });
});

describe('viewerTimezone', () => {
  it("prefers the profile's zone, then the browser's, then the default", () => {
    expect(viewerTimezone('Europe/Lisbon', 'America/Manaus')).toEqual({
      timezone: 'Europe/Lisbon',
      source: 'profile',
    });
    expect(viewerTimezone(null, 'America/Manaus')).toEqual({
      timezone: 'America/Manaus',
      source: 'browser',
    });
    expect(viewerTimezone(null, undefined)).toEqual({
      timezone: DEFAULT_TIMEZONE,
      source: 'default',
    });
  });

  it('ignores a cookie that is not a real zone', () => {
    expect(viewerTimezone(null, '<script>')).toEqual({
      timezone: DEFAULT_TIMEZONE,
      source: 'default',
    });
  });
});

describe('timezoneOptions', () => {
  it('offers every zone, readable, with the zone itself as the value', () => {
    expect(timezoneOptions()).toContainEqual({
      name: 'America/Sao Paulo',
      slug: 'America/Sao_Paulo',
    });
  });
});
