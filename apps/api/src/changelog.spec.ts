import { beforeEach, describe, expect, it, vi } from 'vitest';

const enabled = vi.fn();
vi.mock('./flags', () => ({ apiFlags: () => ({ isEnabled: enabled }) }));
const announce = vi.fn();
vi.mock('@mesaaberta/core/server/notifications/changelog', () => ({
  announceChangelogDay: (...args: unknown[]) => announce(...args),
}));

import { changelogRoutes } from './changelog';

const env = { DATABASE_URL: 'postgres://test' };
const day = { date: '2026-10-27', title: 'Novidades', summary: 'Resumo', link: '/changelog#x' };
const open = () => {
  const close = vi.fn(async () => undefined);
  return Object.assign(() => ({ db: {}, close }) as never, { close });
};
const post = (body: unknown, opened = open()) =>
  changelogRoutes(opened).request(
    '/notice',
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
    env,
  );

describe('api changelog notice', () => {
  beforeEach(() => {
    enabled.mockReset().mockResolvedValue(true);
    announce.mockReset().mockResolvedValue('event-1');
  });

  it('announces the day once the flag is on, and closes the connection', async () => {
    const opened = open();
    const response = await post(day, opened);
    expect(await response.json()).toEqual({ announced: true });
    expect(announce).toHaveBeenCalledWith({}, day);
    expect(enabled).toHaveBeenCalledWith('use_changelog_notices');
    expect(opened.close).toHaveBeenCalledOnce();
  });

  it('says so when the day already went out', async () => {
    announce.mockResolvedValueOnce(null);
    expect(await (await post(day)).json()).toEqual({ announced: false });
  });

  it('does nothing while the flag is off', async () => {
    enabled.mockResolvedValueOnce(false);
    expect(await (await post(day)).json()).toEqual({ announced: false });
    expect(announce).not.toHaveBeenCalled();
  });

  it('refuses a day that is not one, or a link that leaves the site', async () => {
    expect((await post({ ...day, date: 'ontem' })).status).toBe(400);
    expect((await post({ ...day, link: 'https://example.com' })).status).toBe(400);
    expect(announce).not.toHaveBeenCalled();
  });
});
