/**
 * What the readers of a query string need: SvelteKit 3 hands the browser's `page.url.searchParams`
 * as a read-only `ReadonlyURLSearchParams`, which is not a `URLSearchParams` to the type checker
 * (it has no `append`, `set` or `delete`). Everything that only reads, and copies before it
 * changes anything, takes this instead.
 */
export type SearchParamsLike = Pick<URLSearchParams, 'get' | 'getAll' | 'has' | 'toString'> &
  Iterable<[string, string]>;
