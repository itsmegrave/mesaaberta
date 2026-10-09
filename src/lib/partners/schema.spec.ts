import { describe, expect, it } from 'vitest';
import { editPartnerSchema, partnerLinks, partnerLinkUrl } from './schema';

const base = {
  name: 'Taverna do Dado',
  description: '',
  contactEmail: '',
  siteUrl: 'https://taverna.example',
  backlinkUrl: '',
  couponCode: '',
  couponDescription: '',
  linkNetwork: [] as string[],
  linkUrl: [] as string[],
};

const codes = (input: object) => {
  const result = editPartnerSchema.safeParse({ ...base, ...input });
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe('partnerLinkUrl', () => {
  it('takes an invite address for Discord and refuses other hosts', () => {
    expect(partnerLinkUrl('discord', 'https://discord.gg/abc123')).toBe(
      'https://discord.gg/abc123',
    );
    expect(partnerLinkUrl('discord', 'https://evil.example/abc')).toBeNull();
    expect(partnerLinkUrl('discord', 'abc123')).toBeNull();
  });

  it('builds the address of a handle on the other networks', () => {
    expect(partnerLinkUrl('instagram', '@mesaaberta')).toContain('instagram.com/mesaaberta');
  });
});

describe('partner form', () => {
  it('accepts a site alone, and a network alone', () => {
    expect(codes({})).toEqual([]);
    expect(codes({ siteUrl: '', linkNetwork: ['instagram'], linkUrl: ['@mesaaberta'] })).toEqual(
      [],
    );
  });

  it('needs the site or at least one network', () => {
    expect(codes({ siteUrl: '' })).toContain('need_a_link');
    expect(codes({ siteUrl: '', linkNetwork: ['instagram'], linkUrl: ['  '] })).toContain(
      'need_a_link',
    );
  });

  it('allows a coupon description only with a code', () => {
    expect(codes({ couponDescription: '10% off' })).toContain('needs_code');
    expect(codes({ couponCode: 'MESA10', couponDescription: '10% off' })).toEqual([]);
  });

  it('refuses a seventh network, a repeated link and a bad address', () => {
    const many = Array.from({ length: 7 }, (_, i) => `@user${i}`);
    expect(codes({ linkNetwork: many.map(() => 'instagram'), linkUrl: many })).toContain(
      'too_many',
    );
    expect(codes({ linkNetwork: ['instagram', 'instagram'], linkUrl: ['@a', '@a'] })).toContain(
      'duplicate',
    );
    expect(codes({ linkNetwork: ['discord'], linkUrl: ['https://evil.example/x'] })).toContain(
      'invalid_link',
    );
  });

  it('takes an email as optional, lower-cased, and refuses one that is not an address', () => {
    expect(codes({})).toEqual([]);
    expect(codes({ contactEmail: 'Dono@Taverna.example' })).toEqual([]);
    expect(
      editPartnerSchema.parse({ ...base, contactEmail: ' Dono@Taverna.example ' }),
    ).toMatchObject({ contactEmail: 'dono@taverna.example' });
    expect(codes({ contactEmail: 'not-an-email' })).toContain('invalid_email');
  });

  it('refuses a site that is not an address', () => {
    expect(codes({ siteUrl: 'not a url' })).toContain('invalid_url');
  });
});

describe('partnerLinks', () => {
  it('drops empty rows and keeps the order sent', () => {
    expect(
      partnerLinks({ linkNetwork: ['instagram', 'discord', 'x'], linkUrl: ['@a', '', '@b'] }).map(
        (link) => link.network,
      ),
    ).toEqual(['instagram', 'x']);
  });
});
