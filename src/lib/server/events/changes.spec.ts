import { describe, expect, it } from 'vitest';
import { CHANGE_VALUE_LIMIT, diffFields, hasChanges } from './changes';

describe('diffFields', () => {
  it('lists only the fields whose value differs, with the old and the new one', () => {
    expect(
      diffFields(
        { title: 'A', capacity: 5, kind: 'one_shot' },
        { title: 'B', capacity: 5, kind: 'one_shot' },
      ),
    ).toEqual({ title: { from: 'A', to: 'B' } });
  });

  it('counts empty text and a missing value as the same thing, so a form round trip is no change', () => {
    expect(diffFields({ extraInfo: null, note: '' }, { extraInfo: '', note: '   ' })).toEqual({});
  });

  it('writes a date as an ISO time and compares dates by the instant', () => {
    const same = new Date('2026-10-10T22:00:00Z');
    expect(diffFields({ at: same }, { at: new Date(same.getTime()) })).toEqual({});
    expect(diffFields({ at: same }, { at: new Date('2026-10-11T22:00:00Z') })).toEqual({
      at: { from: '2026-10-10T22:00:00.000Z', to: '2026-10-11T22:00:00.000Z' },
    });
  });

  it('writes a list as its items, and an empty list as no value', () => {
    expect(diffFields({ tags: [] as string[] }, { tags: ['terror', 'humor'] })).toEqual({
      tags: { from: null, to: 'terror, humor' },
    });
    expect(diffFields({ tags: ['terror'] }, { tags: [] as string[] })).toEqual({
      tags: { from: 'terror', to: null },
    });
  });

  it('keeps zero and false as values, not as "nothing"', () => {
    expect(diffFields({ seats: 0, open: false }, { seats: 3, open: true })).toEqual({
      seats: { from: 0, to: 3 },
      open: { from: false, to: true },
    });
  });

  it('says that a hidden field changed and never what it was or became', () => {
    const changes = diffFields(
      { joinDetails: 'https://discord.gg/antigo', title: 'A' },
      { joinDetails: 'https://discord.gg/novo', title: 'B' },
      { hidden: ['joinDetails'] },
    );

    expect(changes).toEqual({ joinDetails: { redacted: true }, title: { from: 'A', to: 'B' } });
    expect(JSON.stringify(changes)).not.toContain('discord');
  });

  it('does not mention a hidden field that did not change', () => {
    expect(diffFields({ city: 'Recife' }, { city: 'Recife' }, { hidden: ['city'] })).toEqual({});
  });

  it('cuts a long text on each side, after comparing the whole of it', () => {
    const long = 'a'.repeat(CHANGE_VALUE_LIMIT + 50);
    const changes = diffFields({ text: long }, { text: `${long}!` });

    // Only the end differs, past the cut: the change is still reported.
    expect(changes).toEqual({
      text: {
        from: `${'a'.repeat(CHANGE_VALUE_LIMIT)}…`,
        to: `${'a'.repeat(CHANGE_VALUE_LIMIT)}…`,
      },
    });
  });

  it('only looks at the fields it is given on the new side', () => {
    expect(diffFields({ a: 'x', b: 'y' } as Record<string, string>, { a: 'z' })).toEqual({
      a: { from: 'x', to: 'z' },
    });
  });
});

describe('hasChanges', () => {
  it('is false for no changes and true for any', () => {
    expect(hasChanges({})).toBe(false);
    expect(hasChanges({ a: { redacted: true } })).toBe(true);
  });
});
