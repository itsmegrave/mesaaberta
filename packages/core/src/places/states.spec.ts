import { describe, expect, it } from 'vitest';
import { BRAZIL_STATES, stateOptions } from './states';

describe('the Estado filter', () => {
  it('lists the 26 states and the Distrito Federal, by name', () => {
    expect(BRAZIL_STATES).toHaveLength(27);
    expect(new Set(BRAZIL_STATES.map((state) => state.uf)).size).toBe(27);
    const names = BRAZIL_STATES.map((state) => state.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'pt-BR')));
  });

  it('counts the places of each state, zero where there are none', () => {
    const options = stateOptions(new Map([['pe', 3]]));
    expect(options).toHaveLength(27);
    expect(options.find((option) => option.slug === 'pe')).toEqual({
      slug: 'pe',
      label: 'Pernambuco',
      count: 3,
    });
    expect(options[0]).toEqual({ slug: 'ac', label: 'Acre', count: 0 });
  });

  it('keeps a state outside the 27 at the end, so its places stay findable', () => {
    expect(stateOptions(new Map([['xx', 1]])).at(-1)).toEqual({
      slug: 'xx',
      label: 'XX',
      count: 1,
    });
  });
});
