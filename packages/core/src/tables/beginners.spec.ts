import { describe, expect, it } from 'vitest';
import { BEGINNER_TABLES_HREF, isBeginnerTable } from './beginners';

describe('beginner tables', () => {
  it('reads the tag from slugs or catalog items', () => {
    expect(isBeginnerTable(['roleplay', 'iniciantes'])).toBe(true);
    expect(isBeginnerTable([{ slug: 'iniciantes' }])).toBe(true);
    expect(isBeginnerTable([{ slug: 'terror' }, 'Iniciantes'])).toBe(false);
    expect(isBeginnerTable(undefined)).toBe(false);
  });

  it('links the filtered list', () => {
    expect(BEGINNER_TABLES_HREF).toBe('/tables?tag=iniciantes');
  });
});
