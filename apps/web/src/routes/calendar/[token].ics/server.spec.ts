import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireApi } from '#lib/server/api-required.js';
import { NotFound } from '@mesaaberta/core/server/errors';
import { GET } from './+server';

vi.mock('#lib/server/api-required.js', () => ({ requireApi: vi.fn() }));
beforeEach(() => vi.resetAllMocks());

const token = 'a'.repeat(43);
const call = (on: boolean, value = token) =>
  GET({
    params: { token: value },
    url: new URL(`https://mesaaberta.app/calendar/${value}.ics`),
    locals: { env: {}, flags: { isEnabled: vi.fn(async () => on) } },
  } as unknown as Parameters<typeof GET>[0]);

describe('subscribed calendar feed', () => {
  it('answers 404 for a malformed secret without asking the api', async () => {
    await expect(call(true, 'curto')).rejects.toMatchObject({ status: 404 });
    expect(requireApi).not.toHaveBeenCalled();
  });

  it('answers 404 for a secret the api does not know', async () => {
    vi.mocked(requireApi).mockRejectedValue(new NotFound('not_found'));
    await expect(call(true)).rejects.toMatchObject({ status: 404 });
  });

  it('answers 404 while the flag is off for the owner', async () => {
    vi.mocked(requireApi).mockResolvedValue({ profileId: 'p1', tables: [] });
    await expect(call(false)).rejects.toMatchObject({ status: 404 });
  });

  it('writes the calendar, private and kept out of search engines', async () => {
    vi.mocked(requireApi).mockResolvedValue({
      profileId: 'p1',
      tables: [
        {
          id: '00000000-0000-4000-8000-000000000001',
          slug: 'mesa',
          title: 'Mesa',
          description: '',
          extraInfo: null,
          kind: 'one_shot',
          startsAt: '2099-01-01T20:00:00.000Z',
          durationMinutes: 120,
          timezone: 'America/Sao_Paulo',
          recurrence: null,
          until: null,
          icalSequence: 0,
        },
      ],
    });
    const response = await call(true);
    expect(requireApi).toHaveBeenCalledWith(expect.anything(), null, `/v1/calendar-feed/${token}`);
    expect(response.headers.get('content-type')).toContain('text/calendar');
    expect(response.headers.get('cache-control')).toBe('private, max-age=900');
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
    const body = await response.text();
    expect(body).toContain('BEGIN:VCALENDAR');
    expect(body).toContain('/t/mesa');
  });
});
