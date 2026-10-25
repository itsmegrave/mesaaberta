import { describe, expect, it } from 'vitest';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import type { Extension } from '@mesaaberta/core/server/extensions/index';
import { extensionHandlers } from '@mesaaberta/core/server/extensions/index';
import { socialFor, type SocialPublisher } from '@mesaaberta/core/server/social/index';

// A database that fails on any use, so a test can show an adapter never touches it.
const untouched = new Proxy(
  {},
  {
    get() {
      throw new Error('the database was used');
    },
  },
) as unknown as AnyDb;

describe('socialFor', () => {
  it('is none in the public build, which installs no connector', () => {
    for (const env of [
      undefined,
      {},
      { SOCIAL_PROVIDER: 'instagram' },
      { SOCIAL_PROVIDER: 'none' },
    ])
      expect(socialFor(env).name).toBe('none');
  });

  it('registers no handler and reports itself unconfigured', () => {
    const social = socialFor({});

    expect(social.configured({})).toBe(false);
    expect(social.handlers).toEqual([]);
  });
});

describe('socialFor with other extensions installed', () => {
  const connector = (name: string) => ({ name }) as SocialPublisher;
  const installed: Extension[] = [
    { id: 'patreon' },
    { id: 'mastodon', social: connector('mastodon') },
    { id: 'bluesky', social: connector('bluesky') },
  ];

  it('takes the first installed connector unless SOCIAL_PROVIDER names one', () => {
    expect(socialFor({}, installed).name).toBe('mastodon');
    expect(socialFor({ SOCIAL_PROVIDER: 'bluesky' }, installed).name).toBe('bluesky');
    expect(socialFor({ SOCIAL_PROVIDER: 'none' }, installed).name).toBe('none');
  });

  it('is none when nothing is installed or the named connector is not', () => {
    expect(socialFor({}, []).name).toBe('none');
    expect(socialFor({ SOCIAL_PROVIDER: 'instagram' }, []).name).toBe('none');
    expect(socialFor({ SOCIAL_PROVIDER: 'threads' }, installed).name).toBe('none');
  });
});

describe('extensionHandlers', () => {
  it('collects the handlers the extensions register beside their connectors', () => {
    const handler = { name: 'patreon-sync', types: [], handle: async () => {} };
    expect(extensionHandlers([{ id: 'patreon', handlers: [handler] }, { id: 'none' }])).toEqual([
      handler,
    ]);
    expect(extensionHandlers()).toEqual([]);
  });
});

describe('the none adapter', () => {
  const none = socialFor({ SOCIAL_PROVIDER: 'none' });

  it('is never configured and registers no handler', () => {
    expect(none.configured({ INSTAGRAM_APP_ID: 'x' })).toBe(false);
    expect(none.handlers).toEqual([]);
  });

  it('answers every request as unavailable without touching the database', async () => {
    expect(await none.queueTable(untouched, {}, 'table-1')).toBe('unavailable');
    expect(await none.publishTable(untouched, {}, 'table-1')).toBe('unavailable');
    expect(await none.publishDue(untouched, {})).toBe(0);
  });
});
