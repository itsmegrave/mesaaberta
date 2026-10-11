import { describe, expect, it, vi } from 'vitest';
import { createWorker, type WorkerEnv } from './index';

const env = { CF_VERSION_METADATA: { id: 'v1' } } as WorkerEnv;
const controller = { cron: '*/5 * * * *', scheduledTime: 0 };

describe('worker', () => {
  it('hands the trigger and a release-stamped logger to the scheduled runner', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    await createWorker(run).scheduled(controller, env);
    expect(run).toHaveBeenCalledOnce();
    expect(run.mock.calls[0][0]).toBe(controller);
    expect(run.mock.calls[0][1]).toBe(env);
    expect(run.mock.calls[0][2].log).toBeDefined();
  });

  it('does not throw when the run fails, so one bad run never poisons the next', async () => {
    const run = vi.fn().mockRejectedValue(new Error('boom'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(createWorker(run).scheduled(controller, env)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('answers every request with an empty 404', async () => {
    const response = createWorker().fetch();
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('');
  });
});
