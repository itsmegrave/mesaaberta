import { describe, expect, it, vi } from 'vitest';
import { POST } from './+server';

const user = { id: '22222222-2222-4222-8222-222222222222' };
const event = (body: unknown, who: { id: string } | null = user) => {
  const track = vi.fn();
  const request = new Request('https://mesaaberta.app/api/theme', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return {
    track,
    event: { locals: { getUser: async () => who, track }, request } as unknown as Parameters<
      typeof POST
    >[0],
  };
};
const report = { theme: 'overdrive', theme_choice: 'system', theme_mode: 'dark' };

describe('the theme report', () => {
  it('records the theme in use as an event and as profile labels', async () => {
    const { track, event: e } = event({ kind: 'in_use', ...report });
    const response = await POST(e);
    expect(response.status).toBe(204);
    expect(track).toHaveBeenCalledWith('theme_in_use', user.id, report, { profile: report });
  });

  it('records a change under its own name', async () => {
    const { track, event: e } = event({ kind: 'changed', ...report, theme: 'classic' });
    await POST(e);
    expect(track.mock.lastCall?.[0]).toBe('theme_changed');
  });

  it('passes no id for a visitor, so the tracker sends nothing', async () => {
    const { track, event: e } = event({ kind: 'in_use', ...report }, null);
    await POST(e);
    expect(track.mock.lastCall?.[1]).toBeUndefined();
  });

  it.each([
    ['not json', 'nope'],
    ['an unknown kind', { kind: 'other', ...report }],
    ['an unknown theme', { kind: 'in_use', ...report, theme: 'neon' }],
    ['free text in a label', { kind: 'in_use', ...report, theme_mode: 'dark; drop' }],
  ])('refuses %s', async (_, body) => {
    const { track, event: e } = event(body);
    await expect(POST(e)).rejects.toMatchObject({ status: 400 });
    expect(track).not.toHaveBeenCalled();
  });
});
