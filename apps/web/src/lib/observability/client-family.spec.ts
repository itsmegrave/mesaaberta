import { describe, expect, it } from 'vitest';
import { clientFamilyOf } from './client-family';

describe('clientFamilyOf', () => {
  it.each([
    [
      'Mozilla/5.0 (Linux; Android 14; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
      { browser: 'Chrome', os: 'Android' },
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      { browser: 'Safari', os: 'iOS' },
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
      { browser: 'Edge', os: 'Windows' },
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:131.0) Gecko/20100101 Firefox/131.0',
      { browser: 'Firefox', os: 'macOS' },
    ],
    [
      'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
      { browser: 'Samsung Internet', os: 'Android' },
    ],
    ['curl/8.5.0', { browser: 'Other', os: 'Other' }],
  ])('reads %s', (userAgent, family) => {
    expect(clientFamilyOf(userAgent)).toEqual(family);
  });
});
