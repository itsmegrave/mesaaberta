import { describe, expect, it, vi } from 'vitest';
import { checkInMonitor, type CheckInClient } from './sentry-monitor';

const job = {
  slug: 'worker-event-sweep',
  schedule: '*/5 * * * *',
  checkinMargin: 2,
  maxRuntime: 5,
};

const fakeSdk = () => {
  const calls: string[] = [];
  const sdk = {
    captureCheckIn: vi.fn((checkIn: { status: string }) => {
      calls.push(`check-in ${checkIn.status}`);
      return 'check-in-id';
    }),
    flush: vi.fn(async () => {
      calls.push('flush');
      return true;
    }),
  } satisfies CheckInClient;
  return { sdk, calls };
};

describe('checkInMonitor', () => {
  it('sends the opening check-in before the run, so the closing one cannot overtake it', async () => {
    const { sdk, calls } = fakeSdk();
    const run = vi.fn(async () => {
      calls.push('run');
      return 7;
    });
    await expect(checkInMonitor(sdk)(job, run)).resolves.toBe(7);
    expect(calls).toEqual(['check-in in_progress', 'flush', 'run', 'check-in ok']);
    expect(sdk.captureCheckIn).toHaveBeenNthCalledWith(
      1,
      { monitorSlug: 'worker-event-sweep', status: 'in_progress' },
      expect.objectContaining({
        schedule: { type: 'crontab', value: '*/5 * * * *' },
        checkinMargin: 2,
        maxRuntime: 5,
        timezone: 'Etc/UTC',
      }),
    );
  });

  it('closes with the opening id and the run time in seconds', async () => {
    const { sdk } = fakeSdk();
    const times = [1_000, 7_500];
    await checkInMonitor(sdk, () => times.shift()!)(job, async () => undefined);
    expect(sdk.captureCheckIn).toHaveBeenLastCalledWith({
      monitorSlug: 'worker-event-sweep',
      status: 'ok',
      checkInId: 'check-in-id',
      duration: 6.5,
    });
  });

  it('reports a failed run as an error and rethrows', async () => {
    const { sdk, calls } = fakeSdk();
    const failure = new Error('boom');
    await expect(
      checkInMonitor(sdk)(job, async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(calls.at(-1)).toBe('check-in error');
  });

  it('still runs the job when the flush fails', async () => {
    const { sdk, calls } = fakeSdk();
    sdk.flush.mockRejectedValueOnce(new Error('offline'));
    await checkInMonitor(sdk)(job, async () => {
      calls.push('run');
    });
    expect(calls).toContain('run');
    expect(calls.at(-1)).toBe('check-in ok');
  });
});
