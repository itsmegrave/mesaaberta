import { describe, expect, it } from 'vitest';
import {
  NETWORKS,
  handleUrl,
  isNetwork,
  parseHandle,
  parseSocialUrl,
  socialTarget,
  typedValue,
} from './social-links';

describe('parseSocialUrl', () => {
  it.each([
    ['https://instagram.com/ana', 'https://instagram.com/ana'],
    ['http://example.com/a?b=1', 'http://example.com/a?b=1'],
    ['  https://example.com/ana  ', 'https://example.com/ana'],
    // Typed without a scheme: what people paste from an address bar.
    ['instagram.com/ana', 'https://instagram.com/ana'],
    ['www.example.com', 'https://www.example.com/'],
  ])('accepts %j as %j', (raw, url) => {
    expect(parseSocialUrl(raw)).toBe(url);
  });

  it.each([
    '',
    '   ',
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'ftp://example.com',
    'https://user:secret@example.com',
    'https://',
    'not a url',
    'https://exa mple.com',
    '//example.com',
    `https://example.com/${'a'.repeat(300)}`,
  ])('refuses %j', (raw) => {
    expect(parseSocialUrl(raw)).toBeNull();
  });
});

describe('networks', () => {
  it('knows the networks and a generic website', () => {
    expect(NETWORKS).toContain('instagram');
    expect(NETWORKS).toContain('website');
    expect(isNetwork('instagram')).toBe(true);
    expect(isNetwork('myspace')).toBe(false);
  });
});

describe('parseHandle', () => {
  it.each([
    ['instagram', '@mesaaberta', 'mesaaberta'],
    ['instagram', 'mesaaberta', 'mesaaberta'],
    ['instagram', '  @mesa.aberta ', 'mesa.aberta'],
    // An address of the network's own site gives its handle.
    ['instagram', 'https://www.instagram.com/mesaaberta/?hl=pt', 'mesaaberta'],
    ['tiktok', 'tiktok.com/@ana', 'ana'],
    ['x', 'https://twitter.com/ana', 'ana'],
    ['linkedin', 'https://linkedin.com/in/ana-silva', 'ana-silva'],
    ['bluesky', '@ana.bsky.social', 'ana.bsky.social'],
    ['bluesky', 'https://bsky.app/profile/ana.bsky.social', 'ana.bsky.social'],
    ['github', '@ana', 'ana'],
    ['discord', '@Ana_Dados', 'ana_dados'],
  ] as const)('reads %s %j as %j', (network, raw, handle) => {
    expect(parseHandle(network, raw)).toBe(handle);
  });

  it.each([
    ['instagram', ''],
    ['instagram', '@'],
    ['instagram', 'ana silva'],
    ['instagram', 'https://example.com/ana'],
    ['instagram', 'javascript:alert(1)'],
    ['x', 'x'.repeat(16)],
    ['bluesky', 'ana'],
    ['discord', 'a'],
    ['github', 'ana_dados'],
  ] as const)('refuses %s %j', (network, raw) => {
    expect(parseHandle(network, raw)).toBeNull();
  });
});

describe('handleUrl', () => {
  it('builds the address a handle opens, and has none for Discord', () => {
    expect(handleUrl('instagram', 'ana')).toBe('https://instagram.com/ana');
    expect(handleUrl('tiktok', 'ana')).toBe('https://tiktok.com/@ana');
    expect(handleUrl('linkedin', 'ana')).toBe('https://linkedin.com/in/ana');
    expect(handleUrl('bluesky', 'ana.bsky.social')).toBe(
      'https://bsky.app/profile/ana.bsky.social',
    );
    expect(handleUrl('discord', 'ana')).toBeNull();
  });
});

describe('socialTarget', () => {
  it('shows a handle with its @ and opens its address', () => {
    expect(
      socialTarget({ network: 'github', handle: 'ana', url: 'https://github.com/ana' }),
    ).toEqual({
      text: '@ana',
      href: 'https://github.com/ana',
    });
  });

  it('shows a Discord handle with nothing to open', () => {
    expect(socialTarget({ network: 'discord', handle: 'ana', url: null })).toEqual({
      text: '@ana',
      href: null,
    });
  });

  it('shows a website by its host', () => {
    expect(
      socialTarget({ network: 'website', handle: null, url: 'https://www.exemplo.com.br/x' }),
    ).toEqual({
      text: 'exemplo.com.br',
      href: 'https://www.exemplo.com.br/x',
    });
  });

  it('still works for a link saved before handles, as an address', () => {
    expect(
      socialTarget({ network: 'instagram', handle: null, url: 'https://instagram.com/ana' }),
    ).toEqual({
      text: '@ana',
      href: 'https://instagram.com/ana',
    });
    // Not the network's own address: kept as it was, shown by its host.
    expect(
      socialTarget({ network: 'discord', handle: null, url: 'https://discord.gg/abc' }),
    ).toEqual({
      text: 'discord.gg',
      href: 'https://discord.gg/abc',
    });
  });

  it('refuses an unsafe address', () => {
    expect(
      socialTarget({ network: 'website', handle: null, url: 'javascript:alert(1)' }),
    ).toBeNull();
  });
});

describe('typedValue', () => {
  it('gives back the handle, or the handle read from an old address, or the website address', () => {
    expect(typedValue({ network: 'x', handle: 'ana', url: 'https://x.com/ana' })).toBe('ana');
    expect(typedValue({ network: 'x', handle: null, url: 'https://x.com/ana' })).toBe('ana');
    expect(typedValue({ network: 'website', handle: null, url: 'https://a.com/' })).toBe(
      'https://a.com/',
    );
  });
});
