import { describe, expect, it } from 'vitest';
import { MAIL_HANDLER_NAMES, bellHandlers, handlersFor } from './handlers';

describe('handlersFor', () => {
  it('runs the bell before any e-mail, so a slow provider never delays the in-app notice', () => {
    const names = handlersFor({
      SUPABASE_URL: 'http://127.0.0.1:54341',
      SUPABASE_SECRET_KEY: 'sb_secret_test',
      MAIL_PROVIDER: 'none',
    }).map((handler) => handler.name);
    const mail = names.filter((name) => (MAIL_HANDLER_NAMES as readonly string[]).includes(name));

    expect(mail.length).toBeGreaterThan(0);
    expect(names.slice(0, bellHandlers.length)).toEqual(bellHandlers.map((h) => h.name));
    for (const name of mail)
      expect(names.indexOf(name)).toBeGreaterThanOrEqual(bellHandlers.length);
  });
});
