import { describe, expect, test } from 'vitest';
import { listQuery, nextSort, pageRange, pageSizeOf, pageWindow, showMore, sortOf } from './list';

const params = (query: string) => new URLSearchParams(query);

describe('admin list query string', () => {
  test('only the sizes a page can have are taken, so a made-up size cannot ask for every row', () => {
    expect(pageSizeOf(params('size=50'))).toBe(50);
    expect(pageSizeOf(params('size=5000'))).toBe(20);
    expect(pageSizeOf(params('size=abc'), 30)).toBe(30);
  });

  test('a column the list does not name is not a sort, so the order stays the list’s own', () => {
    const fallback = { id: 'joined', dir: 'desc' } as const;
    expect(sortOf(params('sort=password'), ['user', 'joined'], fallback)).toEqual(fallback);
    expect(sortOf(params('sort=user&dir=desc'), ['user', 'joined'], fallback)).toEqual({
      id: 'user',
      dir: 'desc',
    });
    expect(sortOf(params('sort=user'), ['user', 'joined'], fallback)).toEqual({
      id: 'user',
      dir: 'asc',
    });
    expect(sortOf(params('sort=joined'), ['user', 'joined'], fallback)).toEqual(fallback);
  });

  test('a header click flips the column in use and starts the others ascending', () => {
    expect(nextSort({ id: 'user', dir: 'asc' }, 'user')).toEqual({ id: 'user', dir: 'desc' });
    expect(nextSort({ id: 'user', dir: 'desc' }, 'user')).toEqual({ id: 'user', dir: 'asc' });
    expect(nextSort({ id: 'user', dir: 'desc' }, 'joined')).toEqual({ id: 'joined', dir: 'asc' });
  });

  test('changing a filter drops the page, so a short result is not shown as an empty page 3', () => {
    expect(listQuery(params('q=a&page=3'), { status: 'active' })).toBe('q=a&status=active');
    expect(listQuery(params('q=a&page=3'), { page: 4 })).toBe('q=a&page=4');
    expect(listQuery(params('q=a&page=3'), { page: 1 })).toBe('q=a');
    expect(listQuery(params('q=a&status=x'), { status: null, q: '' })).toBe('');
  });

  test('the footer range and the pager numbers are right at the edges', () => {
    expect(pageRange(1, 20, 0)).toEqual({ from: 0, to: 0 });
    expect(pageRange(2, 20, 26)).toEqual({ from: 21, to: 26 });
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(1, 2)).toEqual([1, 2]);
    expect(pageWindow(6, 20)).toEqual([1, null, 5, 6, 7, null, 20]);
    expect(pageWindow(2, 20)).toEqual([1, 2, 3, null, 20]);
  });

  test('"Mostrar mais" asks for the next size and says how many rows that adds', () => {
    expect(showMore(20, 20, 26)).toEqual({ size: 50, more: 6 });
    expect(showMore(20, 20, 200)).toEqual({ size: 50, more: 30 });
    expect(showMore(100, 100, 200)).toBeNull();
    expect(showMore(20, 9, 9)).toBeNull();
  });
});
