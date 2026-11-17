/**
 * The id that follows one action across the apps (Trello #278). The web Worker names each request
 * (Cloudflare's `cf-ray`, or a uuid), passes it to the api in `x-request-id`, and the outbox stamps
 * it on the events the request records as their `actionId`, so a handler's lines in the worker can
 * be matched to the request that caused them: filter on `requestId` or `actionId` being that id.
 */
export const REQUEST_ID_HEADER = 'x-request-id';

/** A uuid or a `cf-ray` (16 to 32 hex digits, maybe a `-GRU` colo): what the logs keep as an id. */
const REQUEST_ID = /^(?:[a-f0-9]{8}-[a-f0-9-]{27}|[a-f0-9]{16,32}(?:-[A-Z]{3})?)$/i;

/** The id a caller passed, if it is one; anything else (absent, too long, other text) is not. */
export const requestIdFrom = (value: string | null | undefined): string | undefined =>
  value && REQUEST_ID.test(value) ? value : undefined;

type RequestContext = { requestId: string };

/** What holds the current request's id across awaits: `AsyncLocalStorage` fits it as it is. */
export type RequestContextStore = {
  run<R>(context: RequestContext, fn: () => R): R;
  getStore(): RequestContext | undefined;
};

let store: RequestContextStore | null = null;

/**
 * Installs the store. Each app does it once at startup with `new AsyncLocalStorage()`; the packages
 * stay runtime-neutral, and without a store nothing carries an id (tests, scripts).
 */
export const setRequestContextStore = (next: RequestContextStore | null) => {
  store = next;
};

/** Runs `fn` as the request `requestId`: the logger and the outbox read it from there. */
export const withRequestId = <R>(requestId: string, fn: () => R): R =>
  store ? store.run({ requestId }, fn) : fn();

/** The id of the request (or worker run) this code runs for, if one was set. */
export const currentRequestId = (): string | undefined => store?.getStore()?.requestId;
