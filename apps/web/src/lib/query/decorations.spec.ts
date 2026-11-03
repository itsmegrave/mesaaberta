import { describe, expect, it, vi } from 'vitest';
import { loadDecorations } from './decorations';

describe('loadDecorations', () => {
  it('asks about the people drawn in the same moment in one request', async () => {
    const read = vi.fn(async () => ({
      decorations: { ana: { avatar: { kind: 'frame', data: {} } } },
    })) as never;
    const [ana, bia, again] = await Promise.all([
      loadDecorations('Ana', read),
      loadDecorations('bia', read),
      loadDecorations('ana', read),
    ]);
    expect(read).toHaveBeenCalledExactlyOnceWith('/api/decorations?u=ana,bia');
    expect(ana).toEqual({ avatar: { kind: 'frame', data: {} } });
    expect(again).toEqual(ana);
    expect(bia).toEqual({});
  });

  it('fails the people of a request that failed', async () => {
    const read = vi.fn(async () => {
      throw new Error('down');
    }) as never;
    await expect(loadDecorations('ana', read)).rejects.toThrow('down');
  });
});
