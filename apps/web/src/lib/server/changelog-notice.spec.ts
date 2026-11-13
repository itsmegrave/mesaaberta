import { beforeEach, describe, expect, it, vi } from 'vitest';

const send = vi.fn();
vi.mock('./api-client', () => ({ sendToApi: (...args: unknown[]) => send(...args) }));
vi.mock('#lib/changelog.js', () => ({
  releases: [{ date: '2026-11-13', title: 'Novidades', summary: 'Resumo' }],
  releaseHref: (date: string) => `/changelog#${date}`,
}));
vi.mock('#lib/paraglide/messages.js', () => ({
  changelog_notice_title: ({ title }: { title: string }) => title,
}));

const { handleChangelogNotice, resetChangelogNotice } = await import('./changelog-notice');

const store = new Map<string, string>();
const cache = {
  get: async (url: string) => store.get(url),
  set: async (url: string, body: string) => void store.set(url, body),
};

/** One request; resolves once its after-response task is done. */
const request = async (withCache = true) => {
  const tasks: Promise<unknown>[] = [];
  await handleChangelogNotice({
    event: {
      locals: {
        env: {},
        host: withCache ? { cache } : {},
        log: { warn: vi.fn() },
        afterResponse: (task: () => Promise<unknown>) => tasks.push(task()),
      },
    } as never,
    resolve: async () => new Response('ok'),
  });
  await Promise.all(tasks);
};

const answer = (body: unknown) => Response.json(body);

beforeEach(() => {
  resetChangelogNotice();
  store.clear();
  send.mockReset();
});

describe('handleChangelogNotice', () => {
  it('stops asking once the api says the day is settled, and tells the next isolates', async () => {
    send.mockResolvedValue(answer({ announced: true, settled: true }));
    await request();
    expect(send).toHaveBeenCalledOnce();

    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60 * 60 * 1000);
    await request();
    expect(send).toHaveBeenCalledOnce();

    // A new isolate finds the marker and skips the call.
    resetChangelogNotice();
    await request();
    expect(send).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
  });

  it('asks again later while the flag is off', async () => {
    send.mockResolvedValue(answer({ announced: false, settled: false }));
    await request(false);
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 11 * 60 * 1000);
    await request(false);
    expect(send).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });
});
