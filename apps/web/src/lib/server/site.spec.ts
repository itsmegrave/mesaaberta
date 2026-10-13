import { describe, expect, it, vi } from 'vitest';
import { siteOf } from '@mesaaberta/core/server/site';

describe('siteOf', () => {
  it("reads the deployment's public facts and nothing else", () => {
    const site = siteOf({
      APP_ORIGIN: 'https://jogos.example.org',
      CONTACT_EMAIL: 'oi@example.org',
      PRIVACY_CONTROLLER_NAME: 'Pessoa Responsável',
      PRIVACY_EMAIL: 'dados@example.org',
      INSTAGRAM_HANDLE: 'jogos.example',
      SUPABASE_SECRET_KEY: 'never-on-a-page',
    } as never);

    expect(site).toMatchObject({
      APP_ORIGIN: 'https://jogos.example.org',
      CONTACT_EMAIL: 'oi@example.org',
      PRIVACY_CONTROLLER_NAME: 'Pessoa Responsável',
      PRIVACY_EMAIL: 'dados@example.org',
      INSTAGRAM_HANDLE: 'jogos.example',
    });
    expect(JSON.stringify(site)).not.toContain('never-on-a-page');
  });

  it('takes placeholders for blank variables and has no Instagram', () => {
    const site = siteOf({ CONTACT_EMAIL: '', INSTAGRAM_HANDLE: '' } as never);

    expect(site.CONTACT_EMAIL).toBe('contact@example.invalid');
    expect(site.INSTAGRAM_HANDLE).toBeUndefined();
  });

  it('logs a malformed variable and falls back instead of failing the page', () => {
    const warn = vi.fn();
    const site = siteOf({ CONTACT_EMAIL: 'not an address' } as never, { warn });

    expect(site.CONTACT_EMAIL).toBe('contact@example.invalid');
    expect(warn).toHaveBeenCalledWith('site configuration invalid', {
      code: 'site_config_invalid',
    });
  });
});
