/**
 * Times the queries a postgres.js client runs, for the `db` part of `Server-Timing`. Drizzle talks
 * to the client through `unsafe` (one query) and `begin` (a transaction, whose callback gets its
 * own client), so the wrapper covers both; any other property passes through untouched.
 *
 * A query is timed from the moment it is awaited until it settles, which is when postgres.js sends
 * it. Queries that overlap each add their own time, so the sum can exceed the request's wall time.
 */
export type OnQuery = (seconds: number) => void;

type Thenable = { then: (ok?: (v: never) => unknown, fail?: (e: unknown) => unknown) => unknown };

/**
 * Watches every query a client runs: called with the SQL text when the query is awaited (sent),
 * it may answer a function called once when the query settles, with the error if it failed. The
 * api uses it to record each query as a Sentry `db` span, which is what N+1 detection reads.
 */
export type QueryObserver = (sql: string) => ((error?: unknown) => void) | void;

let observer: QueryObserver | undefined;

/** Sets (or, with nothing, clears) the observer every client from `createDb` reports to. */
export const observeQueries = (next?: QueryObserver) => {
  observer = next;
};

export const queryObserver = () => observer;

const watched = <T extends Thenable>(query: T, sql: string, watch: QueryObserver): T => {
  const then = query.then.bind(query);
  let settle: ((error?: unknown) => void) | void | undefined;
  let open = false;
  query.then = (ok, fail) => {
    if (!open) {
      open = true;
      settle = watch(sql);
    }
    const done = (error?: unknown) => {
      if (!open) return;
      open = false;
      settle?.(error);
      settle = undefined;
    };
    return then(
      (value: never) => {
        done();
        return ok ? ok(value) : value;
      },
      (error: unknown) => {
        done(error);
        if (fail) return fail(error);
        throw error;
      },
    );
  };
  return query;
};

/** Runs `watch` around every query `client` sends, inside transactions too. */
export function withQueryObserver<T extends object>(client: T, watch: QueryObserver): T {
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;

      if (prop === 'unsafe')
        return (...args: unknown[]) =>
          watched(
            (value as (...a: unknown[]) => Thenable).apply(target, args),
            String(args[0]),
            watch,
          );

      if (prop === 'begin')
        return (...args: unknown[]) => {
          // The transaction callback is the last argument; it receives the transaction's own client.
          const last = args.length - 1;
          const callback = args[last] as (sql: object) => unknown;
          const wrapped = (sql: object) => callback(withQueryObserver(sql, watch));
          return (value as (...a: unknown[]) => unknown).apply(target, [
            ...args.slice(0, last),
            wrapped,
          ]);
        };

      return value.bind(target);
    },
    apply(target, thisArg, args) {
      // The client is also a tagged-template function; a call is not watched here (Drizzle never makes one).
      return Reflect.apply(target as unknown as (...a: unknown[]) => unknown, thisArg, args);
    },
  });
}

/** `client` is a postgres.js `Sql`; typed loosely so this file needs no import from `postgres`. */
export function withQueryTiming<T extends object>(client: T, onQuery: OnQuery): T {
  return withQueryObserver(client, () => {
    const started = performance.now();
    return () => onQuery((performance.now() - started) / 1000);
  });
}
