import { describe, expect, it, vi } from 'vitest';
import type { AnyDb } from '../db/client';
import type { Flags } from '../flags/flags';
import type { Extension } from './contract';
import { settingsCardsFor } from './index';

const db = {} as AnyDb;
const flags = {} as Flags;
const save = vi.fn();

describe('settingsCardsFor', () => {
  it('collects the cards the extensions have for the person, in install order', async () => {
    const list: Extension[] = [
      { id: 'plain' },
      { id: 'none', settings: { forPerson: async () => null, save } },
      { id: 'b', settings: { forPerson: async () => ({ kind: 'b', data: {} }), save } },
      { id: 'a', settings: { forPerson: async (_db, id) => ({ kind: 'a', data: { id } }), save } },
    ];
    expect(await settingsCardsFor(db, 'p1', flags, list)).toEqual([
      { ext: 'b', card: { kind: 'b', data: {} } },
      { ext: 'a', card: { kind: 'a', data: { id: 'p1' } } },
    ]);
  });
});
