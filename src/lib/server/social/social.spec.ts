import { describe, expect, it } from 'vitest';
import type { AnyDb } from '../db/client';
import { socialFor } from './index';

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
  it('is Instagram unless the deployment opts out', () => {
    expect(socialFor(undefined).name).toBe('instagram');
    expect(socialFor({}).name).toBe('instagram');
    expect(socialFor({ SOCIAL_PROVIDER: 'instagram' }).name).toBe('instagram');
    expect(socialFor({ SOCIAL_PROVIDER: 'none' }).name).toBe('none');
  });

  it('keeps registering the Instagram queue handler, whatever the credentials', () => {
    const social = socialFor({});

    expect(social.configured({})).toBe(false);
    expect(social.handlers.map((handler) => handler.name)).toEqual(['instagram-queue']);
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
