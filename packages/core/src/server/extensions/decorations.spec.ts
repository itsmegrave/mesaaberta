import { describe, expect, it, vi } from 'vitest';
import type { AnyDb } from '../db/client';
import type { Flags } from '../flags/flags';
import type { DecorationSurface, Extension } from './contract';
import { decorationsFor, MAX_DECORATED } from './index';

const db = {} as AnyDb;
const flags = {} as Flags;
const ext = (id: string, decorations?: DecorationSurface): Extension => ({ id, decorations });
const frame = (kind: string) => ({ kind, data: {} });

describe('decorationsFor', () => {
  it('asks nothing when nobody is asked about', async () => {
    const forPeople = vi.fn();
    expect(await decorationsFor(db, [' ', ''], flags, [ext('a', { forPeople })])).toEqual({});
    expect(forPeople).not.toHaveBeenCalled();
  });

  it('asks each extension about the lowercase usernames once, and keeps the first one per place', async () => {
    const first = vi.fn(async () => ({ ana: { avatar: frame('gold') } }));
    const second = vi.fn(async () => ({
      ana: { avatar: frame('runes'), profile: frame('band') },
      bia: { profile: frame('band') },
    }));
    const found = await decorationsFor(db, ['Ana', 'ana', 'bia'], flags, [
      ext('a', { forPeople: first }),
      ext('none'),
      ext('b', { forPeople: second }),
    ]);
    expect(first).toHaveBeenCalledWith(db, ['ana', 'bia'], flags);
    expect(found).toEqual({
      ana: { avatar: frame('gold'), profile: frame('band') },
      bia: { profile: frame('band') },
    });
  });

  it('drops people nobody asked about and caps how many are asked', async () => {
    const forPeople = vi.fn(async () => ({ eve: { avatar: frame('gold') } }));
    const many = Array.from({ length: MAX_DECORATED + 5 }, (_, i) => `p${i}`);
    expect(await decorationsFor(db, many, flags, [ext('a', { forPeople })])).toEqual({});
    expect(forPeople.mock.calls[0][1]).toHaveLength(MAX_DECORATED);
  });
});
