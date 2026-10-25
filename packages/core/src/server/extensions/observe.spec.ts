import { describe, expect, it, vi } from 'vitest';
import { createLogger, type Level } from '../logger';
import { logInstalled, observedLoad } from './observe';

const capture = () => {
  const lines: { level: Level; line: Record<string, unknown> }[] = [];
  const log = createLogger({
    write: (level, line) => lines.push({ level, line: JSON.parse(line) }),
  });
  return { lines, log };
};

describe('extension observability', () => {
  it('names each installed extension, or says there are none', () => {
    const { lines, log } = capture();
    logInstalled([{ id: 'instagram' }, { id: 'apoia' }], log);
    logInstalled([], log);

    expect(lines.map(({ line }) => [line.msg, line.resourceId])).toEqual([
      ['extension.installed', 'instagram'],
      ['extension.installed', 'apoia'],
      ['extensions.none', undefined],
    ]);
  });

  it('logs a load with its duration and returns the module', async () => {
    const { lines, log } = capture();
    const clock = vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(142);

    const loaded = await observedLoad('panel', 'instagram', async () => 'module', log, clock);

    expect(loaded).toBe('module');
    expect(lines[0]).toMatchObject({
      level: 'info',
      line: {
        msg: 'extension.loaded',
        resourceType: 'panel',
        resourceId: 'instagram',
        durationMs: 42,
      },
    });
  });

  it('logs a failed load as an error, with the error type only, and rethrows it', async () => {
    const { lines, log } = capture();
    const failure = new TypeError('secret path /srv/private');

    await expect(
      observedLoad('panel', 'instagram', () => Promise.reject(failure), log),
    ).rejects.toBe(failure);

    expect(lines[0].level).toBe('error');
    expect(lines[0].line).toMatchObject({
      msg: 'extension.load_failed',
      resourceId: 'instagram',
      errorType: 'TypeError',
    });
    expect(JSON.stringify(lines[0].line)).not.toContain('secret path');
  });
});
