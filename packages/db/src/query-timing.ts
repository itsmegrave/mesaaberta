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

const timed = <T extends Thenable>(query: T, onQuery: OnQuery): T => {
  const then = query.then.bind(query);
  let started: number | undefined;
  query.then = (ok, fail) => {
    started ??= performance.now();
    const done = () => {
      if (started === undefined) return;
      const elapsed = (performance.now() - started) / 1000;
      started = undefined;
      onQuery(elapsed);
    };
    return then(
      (value: never) => {
        done();
        return ok ? ok(value) : value;
      },
      (error: unknown) => {
        done();
        if (fail) return fail(error);
        throw error;
      },
    );
  };
  return query;
};

/** `client` is a postgres.js `Sql`; typed loosely so this file needs no import from `postgres`. */
export function withQueryTiming<T extends object>(client: T, onQuery: OnQuery): T {
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;

      if (prop === 'unsafe')
        return (...args: unknown[]) =>
          timed((value as (...a: unknown[]) => Thenable).apply(target, args), onQuery);

      if (prop === 'begin')
        return (...args: unknown[]) => {
          // The transaction callback is the last argument; it receives the transaction's own client.
          const last = args.length - 1;
          const callback = args[last] as (sql: object) => unknown;
          const wrapped = (sql: object) => callback(withQueryTiming(sql, onQuery));
          return (value as (...a: unknown[]) => unknown).apply(target, [
            ...args.slice(0, last),
            wrapped,
          ]);
        };

      return value.bind(target);
    },
    apply(target, thisArg, args) {
      // The client is also a tagged-template function; a call is not timed here (Drizzle never makes one).
      return Reflect.apply(target as unknown as (...a: unknown[]) => unknown, thisArg, args);
    },
  });
}
