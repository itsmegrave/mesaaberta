import { describe, expect, it } from 'vitest';
import { textArray } from './text-array';

describe('textArray', () => {
  it('parses the text postgres.js hands over without fetch_types', () => {
    expect(textArray('{ana,bruno}')).toEqual(['ana', 'bruno']);
    expect(textArray('{}')).toEqual([]);
    expect(textArray('{"a b","c,d"}')).toEqual(['a b', 'c,d']);
  });

  it('keeps an array a driver already parsed', () => {
    expect(textArray(['ana'])).toEqual(['ana']);
  });

  it('reads nothing as an empty list', () => {
    expect(textArray(null)).toEqual([]);
  });
});
