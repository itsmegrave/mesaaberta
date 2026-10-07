import { describe, expect, it } from 'vitest';
import { normalizeCampaignUrl } from './url';

describe('normalizeCampaignUrl', () => {
  it('refuses what is not an https address', () => {
    expect(normalizeCampaignUrl('http://catarse.me/x')).toBeNull();
    expect(normalizeCampaignUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeCampaignUrl('catarse.me/x')).toBeNull();
    expect(normalizeCampaignUrl('')).toBeNull();
  });

  it('refuses an address carrying credentials', () => {
    expect(normalizeCampaignUrl('https://user:pass@catarse.me/x')).toBeNull();
  });

  it('makes the same campaign one address however it was shared', () => {
    const canonical = 'https://catarse.me/meu-rpg';
    expect(normalizeCampaignUrl('https://www.Catarse.me/meu-rpg/')).toBe(canonical);
    expect(normalizeCampaignUrl('https://catarse.me/meu-rpg#comments')).toBe(canonical);
    expect(normalizeCampaignUrl('https://catarse.me/meu-rpg?utm_source=x&fbclid=y')).toBe(
      canonical,
    );
  });

  it('keeps the parameters that pick the campaign, in a fixed order', () => {
    expect(normalizeCampaignUrl('https://example.com/p?b=2&a=1')).toBe(
      'https://example.com/p?a=1&b=2',
    );
  });

  it('keeps a different path as a different campaign', () => {
    expect(normalizeCampaignUrl('https://catarse.me/a')).not.toBe(
      normalizeCampaignUrl('https://catarse.me/b'),
    );
  });
});
