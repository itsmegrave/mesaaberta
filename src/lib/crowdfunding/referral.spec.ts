import { describe, expect, it } from 'vitest';
import { campaignReferralUrl } from './referral';
import { normalizeCampaignUrl } from './url';

describe('campaignReferralUrl', () => {
  it.each(['catarse.me', 'www.catarse.com.br'])(
    'uses Catarse ref and UTM attribution on %s',
    (host) => {
      const url = new URL(campaignReferralUrl(`https://${host}/rpg`)!);
      expect(url.searchParams.get('ref')).toBe('mesaaberta');
      expect(url.searchParams.get('utm_source')).toBe('mesaaberta');
      expect(url.searchParams.get('utm_medium')).toBe('referral');
      expect(url.searchParams.get('utm_campaign')).toBe('crowdfunding');
    },
  );

  it.each(['meeplestarter.com.br', 'mail.meeplestarter.com.br'])(
    'uses Meeplestarter UTM attribution without inventing ref on %s',
    (host) => {
      const url = new URL(campaignReferralUrl(`https://${host}/rpg`)!);
      expect(url.searchParams.get('ref')).toBeNull();
      expect(url.searchParams.get('utm_source')).toBe('mesaaberta');
      expect(url.searchParams.get('utm_medium')).toBe('referral');
    },
  );

  it('replaces old attribution, preserves reward selection and fragments, and retains canonical identity', () => {
    const raw =
      'https://catarse.me/rpg?reward=42&utm_source=old&utm_source=duplicate&utm_content=old&ref=old#rewards';
    const tagged = campaignReferralUrl(raw)!;
    const url = new URL(tagged);
    expect(url.searchParams.getAll('utm_source')).toEqual(['mesaaberta']);
    expect(url.searchParams.has('utm_content')).toBe(false);
    expect(url.searchParams.get('reward')).toBe('42');
    expect(url.hash).toBe('#rewards');
    expect(campaignReferralUrl(tagged)).toBe(tagged);
    expect(normalizeCampaignUrl(tagged)).toBe(normalizeCampaignUrl(raw));
  });

  it('leaves other platforms and lookalike hosts unchanged', () => {
    for (const raw of [
      'https://kickstarter.com/rpg',
      'https://evil.com/rpg',
      'https://catarse.me.evil.com/rpg',
    ]) {
      expect(campaignReferralUrl(raw)).toBe(raw);
    }
  });

  it('does not turn invalid or credential-bearing addresses into outbound links', () => {
    for (const raw of [
      'javascript:alert(1)',
      'http://catarse.me/rpg',
      'https://user:pass@catarse.me/rpg',
      'invalid',
    ]) {
      expect(campaignReferralUrl(raw)).toBeUndefined();
    }
  });
});
