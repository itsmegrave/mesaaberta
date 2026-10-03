import { describe, expect, it } from 'vitest';
import { publicConfig, readConfig } from '../../packages/config/src/index';

describe('portable deployment configuration', () => {
  const productionEnv = {
    APP_ORIGIN: 'https://mesaaberta.app',
    CONTACT_EMAIL: 'contact@example.org',
    PRIVACY_CONTROLLER_NAME: 'Mesa Aberta',
    PRIVACY_EMAIL: 'privacy@example.org',
    CALENDAR_UID_DOMAIN: 'mesaaberta.app',
  };

  it('requires explicit production identity and calendar settings', () => {
    expect(() => readConfig({}, { mode: 'production' })).toThrow(
      'Invalid deployment configuration: APP_ORIGIN, CONTACT_EMAIL, PRIVACY_CONTROLLER_NAME, PRIVACY_EMAIL, CALENDAR_UID_DOMAIN',
    );
  });

  it.each(Object.keys(productionEnv))('rejects a blank production setting: %s', (field) => {
    expect(() => readConfig({ ...productionEnv, [field]: '  ' }, { mode: 'production' })).toThrow(
      `Invalid deployment configuration: ${field}`,
    );
  });

  it('preserves existing calendar identifiers when the production origin changes', () => {
    expect(
      readConfig(
        { ...productionEnv, APP_ORIGIN: 'https://new.example.org' },
        { mode: 'production' },
      ),
    ).toMatchObject({
      APP_ORIGIN: 'https://new.example.org',
      CALENDAR_UID_DOMAIN: 'mesaaberta.app',
    });
  });

  it('runs with local defaults and optional integrations disabled', () => {
    const config = readConfig();
    expect(config.APP_ORIGIN).toBe('http://localhost:5173');
    expect(config.CALENDAR_UID_DOMAIN).toBe('localhost');
    expect(config.INSTAGRAM_HANDLE).toBeUndefined();
    expect(config.CANNY_APP_ID).toBeUndefined();
  });

  it('uses the same defaults for empty Wrangler bindings', () => {
    expect(readConfig({ APP_ORIGIN: '', CANNY_APP_ID: '  ', CONTACT_EMAIL: undefined })).toEqual(
      readConfig(),
    );
  });

  it('normalizes the origin without coupling the stable calendar namespace to it', () => {
    expect(
      readConfig({
        APP_ORIGIN: ' https://games.example.org/ ',
        CALENDAR_UID_DOMAIN: 'calendar.example.org',
      }),
    ).toMatchObject({
      APP_ORIGIN: 'https://games.example.org',
      CALENDAR_UID_DOMAIN: 'calendar.example.org',
    });
  });

  it.each([
    'not a URL',
    'javascript:alert(1)',
    'ftp://example.org',
    'https://user:password@example.org',
    'https://example.org/app',
    'https://example.org/?token=private',
    'https://example.org/#fragment',
  ])('rejects an origin that would create unsafe or incorrect links: %s', (APP_ORIGIN) => {
    expect(() => readConfig({ APP_ORIGIN })).toThrow(
      'Invalid deployment configuration: APP_ORIGIN',
    );
  });

  it('reports only field names, never credentials or raw configuration', () => {
    expect(() => readConfig({ APP_ORIGIN: 'https://user:private-secret@example.org' })).toThrow(
      /^Invalid deployment configuration: APP_ORIGIN$/,
    );
  });

  it('allows separate instances with independent public contacts and feedback settings', () => {
    expect(
      publicConfig(
        readConfig({
          APP_ORIGIN: 'https://games.example.org',
          CONTACT_EMAIL: 'hello@example.org',
          PRIVACY_CONTROLLER_NAME: 'Coletivo de jogos',
          PRIVACY_EMAIL: 'privacy@example.org',
          INSTAGRAM_HANDLE: 'our.games',
          CANNY_APP_ID: '0123456789abcdef01234567',
          CANNY_FEEDBACK_URL: 'https://games.canny.io/feedback',
        }),
      ),
    ).toMatchObject({ CONTACT_EMAIL: 'hello@example.org', INSTAGRAM_HANDLE: 'our.games' });
  });

  it('never exposes secret, unknown or server-only fields in public page data', () => {
    const config = readConfig({
      SUPABASE_SECRET_KEY: 'private',
      RESEND_API_KEY: 'private',
      INSTAGRAM_TOKEN_KEY: 'private',
      CALENDAR_UID_DOMAIN: 'private.example.org',
    });
    const data = publicConfig(Object.assign({}, config, { RESEND_API_KEY: 'also-private' }));
    expect(data).not.toHaveProperty('RESEND_API_KEY');
    expect(data).not.toHaveProperty('SUPABASE_SECRET_KEY');
    expect(data).not.toHaveProperty('INSTAGRAM_TOKEN_KEY');
    expect(data).not.toHaveProperty('CALENDAR_UID_DOMAIN');
  });

  it.each([
    { CALENDAR_UID_DOMAIN: 'example.org\r\nATTENDEE:intruder' },
    { CALENDAR_UID_DOMAIN: 'example..org' },
    { INSTAGRAM_HANDLE: '../someone' },
    { CANNY_FEEDBACK_URL: 'javascript:alert(1)' },
    { PRIVACY_EMAIL: 'invalid' },
  ])('rejects malformed public settings and calendar identifiers: %j', (env) => {
    expect(() => readConfig(env)).toThrow('Invalid deployment configuration:');
  });
});
