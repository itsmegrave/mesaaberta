// What every admin list shares: the sizes a page can have, a column's sort order and the address of
// a list with one thing changed. The query string is the contract (`?q=&status=&sort=&dir=&page=&size=`),
// so a link to a filtered, sorted list keeps working and the first page has no `page`.

export const PAGE_SIZES = [20, 50, 100] as const;

/** `?size=`: one of the sizes a page can have, `fallback` for anything else. */
export function pageSizeOf(params: URLSearchParams, fallback: number = PAGE_SIZES[0]) {
  const size = Number(params.get('size'));
  return (PAGE_SIZES as readonly number[]).includes(size) ? size : fallback;
}

export type SortDirection = 'asc' | 'desc';
export type Sort<Id extends string = string> = { id: Id; dir: SortDirection };

/**
 * `?sort=<column>&dir=<asc|desc>`: only the columns a list names can be ordered by, anything else
 * is the list's own order. `dir` falls back to the one `fallback` gives that column.
 */
export function sortOf<Id extends string>(
  params: URLSearchParams,
  allowed: readonly Id[],
  fallback: Sort<Id>,
): Sort<Id> {
  const id = params.get('sort');
  if (!id || !(allowed as readonly string[]).includes(id)) return fallback;
  const dir = params.get('dir');
  return {
    id: id as Id,
    dir: dir === 'asc' || dir === 'desc' ? dir : id === fallback.id ? fallback.dir : 'asc',
  };
}

/** The column's next sort: the other direction when it is the one in use, else ascending. */
export function nextSort(current: Sort, id: string): Sort {
  return { id, dir: current.id === id && current.dir === 'asc' ? 'desc' : 'asc' };
}

/**
 * The query string of a list with `changes` applied to `current`. A `null` (or an empty text)
 * removes the key; everything but a new page starts over on the first one.
 */
export function listQuery(
  current: URLSearchParams,
  changes: Record<string, string | number | null | undefined>,
) {
  const params = new URLSearchParams(current);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === undefined || value === '') params.delete(key);
    else params.set(key, String(value));
  }
  if (!('page' in changes) || Number(changes.page) <= 1) params.delete('page');
  return params.toString();
}

/** The path with that query, and the `hash` a list uses to keep its place. */
export function listPath(path: string, query: string, hash = '') {
  return `${path}${query ? `?${query}` : ''}${hash}`;
}

/** "1–20" of a page: the first and last row it shows, for the footer's "1–20 de 132". */
export function pageRange(page: number, pageSize: number, total: number) {
  if (total === 0) return { from: 0, to: 0 };
  return { from: (page - 1) * pageSize + 1, to: Math.min(total, page * pageSize) };
}

/**
 * The page numbers a pager shows: the first, the last and the ones around the current, with `null`
 * where numbers are left out ("1 … 4 5 6 … 20").
 */
export function pageWindow(page: number, pages: number): (number | null)[] {
  const wanted = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const sorted = [...wanted].sort((a, b) => a - b);
  const shown: (number | null)[] = [];
  for (const [index, number] of sorted.entries()) {
    if (index > 0 && number - sorted[index - 1] > 1) shown.push(null);
    shown.push(number);
  }
  return shown;
}

/** What "Mostrar mais" shows on a phone: the next page size, and how many more rows that adds. */
export function showMore(pageSize: number, shown: number, total: number) {
  const next = PAGE_SIZES.find((size) => size > pageSize);
  if (next === undefined || shown >= total) return null;
  return { size: next, more: Math.min(next, total) - shown };
}
