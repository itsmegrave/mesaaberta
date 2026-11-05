import { currentRequestId, REQUEST_ID_HEADER } from '@mesaaberta/contracts';
import { logger, type Logger } from '@mesaaberta/core/server/logger';

/** The Service Binding to the api Worker (`env.API`); absent until the api is deployed and bound. */
export type ApiBinding = { fetch: (request: Request) => Promise<Response> };

/**
 * The api path as a template, for logs: a table's slug, a username and any id become `:param`, so
 * telemetry carries which route failed and never which table, partner or person it was about.
 */
export function routeTemplate(path: string): string {
  const segments = path.split('?')[0].split('/');
  return segments
    .map((segment, i) => {
      const before = segments[i - 1];
      const dynamic =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment) ||
        before === 'tables' ||
        before === 'manage' ||
        before === 'profiles' ||
        // A calendar feed's secret must never reach a log.
        before === 'calendar-feed' ||
        (before === 'table-writes' && i < segments.length - 1);
      return dynamic ? ':param' : segment;
    })
    .join('/');
}

/** What the api answered, whatever the status; null from `callApiRaw` means nothing was answered. */
export type ApiAnswer = { ok: boolean; status: number; body: unknown };

/**
 * Sends one request to the api Worker as `actorId`: over its Service Binding on Cloudflare, or to
 * its private address with the shared secret self-hosted. Null when neither is configured; a
 * network error throws.
 */
export async function sendToApi(
  env: App.Locals['env'],
  path: string,
  actorId: string | null,
  {
    method = 'GET',
    json,
    headers = {},
  }: { method?: 'GET' | 'POST' | 'DELETE'; json?: unknown; headers?: Record<string, string> } = {},
): Promise<Response | null> {
  const settings = env as
    { API?: ApiBinding; API_URL?: string; API_INTERNAL_TOKEN?: string } | undefined;
  const binding = settings?.API;
  const remote = !binding && settings?.API_URL && settings.API_INTERNAL_TOKEN ? settings : null;
  if (!binding && !remote) return null;
  const requestId = currentRequestId();
  // With a Service Binding the host is never resolved: it routes by binding, not by name.
  const send = binding ? binding.fetch.bind(binding) : (request: Request) => fetch(request);
  const origin = binding ? 'https://api.internal' : remote!.API_URL!.replace(/\/$/, '');
  return send(
    new Request(`${origin}${path}`, {
      method,
      headers: {
        ...headers,
        ...(remote ? { 'x-internal-token': remote.API_INTERNAL_TOKEN! } : {}),
        ...(actorId ? { 'x-actor-id': actorId } : {}),
        // The same request id on both sides, so the api's lines join the web request's.
        ...(requestId ? { [REQUEST_ID_HEADER]: requestId } : {}),
        ...(json === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(json === undefined ? {} : { body: JSON.stringify(json) }),
      signal: AbortSignal.timeout(25_000),
    }),
  );
}

/**
 * Calls the api Worker over its Service Binding as `actorId` (the api checks that person is an
 * admin again). Resolves to null only when the call could not be made (no binding, a network error
 * or a body that is not JSON), so the caller can keep its own path; any answer, a refusal included,
 * is returned. Never throws.
 */
export async function callApiRaw(
  env: App.Locals['env'],
  path: string,
  actorId: string | null,
  log: Logger = logger,
  json?: unknown,
  headers: Record<string, string> = {},
  method: 'GET' | 'POST' | 'DELETE' = 'POST',
): Promise<ApiAnswer | null> {
  const first = await answerOnce(env, path, actorId, log, json, headers, method);
  // A read is safe to send again. When the answer was not the api's JSON (Cloudflare's error page,
  // an empty 500, or a body cut off mid-stream) that isolate failed while the next one usually does
  // not: one more try, a moment later, keeps the page up instead of a 503.
  if (first.kind === 'not_json' && method === 'GET') {
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    const second = await answerOnce(env, path, actorId, log, json, headers, method, 2);
    return second.kind === 'answer' ? second.answer : null;
  }
  return first.kind === 'answer' ? first.answer : null;
}

/** How long a failed read waits before its one retry. */
export const RETRY_DELAY_MS = 150;

type Attempt =
  { kind: 'answer'; answer: ApiAnswer } | { kind: 'not_json'; status: number } | { kind: 'none' };

async function answerOnce(
  env: App.Locals['env'],
  path: string,
  actorId: string | null,
  log: Logger,
  json: unknown,
  headers: Record<string, string>,
  method: 'GET' | 'POST' | 'DELETE',
  attempt = 1,
): Promise<Attempt> {
  let response: Response | null = null;
  let text: string | undefined;
  try {
    response = await sendToApi(env, path, actorId, { method, json, headers });
    if (!response) return { kind: 'none' };
    text = await response.text();
    const body = JSON.parse(text);
    return { kind: 'answer', answer: { ok: response.ok, status: response.status, body } };
  } catch (error) {
    // With a status, the api (or Cloudflare in front of it) answered something that is not JSON:
    // an error page when the api Worker itself failed, or a body that broke off. Without one, the
    // call never got an answer.
    const status = response?.status;
    log.warn('api.call_failed', {
      code: status === undefined ? 'api_call_failed' : 'api_answer_not_json',
      // Not `route`: the web request's logger stamps its own page route over that field.
      apiRoute: routeTemplate(path),
      method,
      status,
      attempt,
      reason: cloudflareErrorOf(text),
      ...(response && answerShapeOf(response, text)),
      error,
    });
    return status === undefined ? { kind: 'none' } : { kind: 'not_json', status };
  }
}

/**
 * What a failed answer looked like, never its text: whether a body arrived and of what kind, its
 * size, and where Cloudflare placed the api (`cf-placement`, e.g. `remote-GRU`), so an incident can
 * tell an empty platform 500 from an error page or a body cut off mid-stream.
 */
export function answerShapeOf(
  response: Response,
  text: string | undefined,
): { bodyKind: string; bodyBytes?: number; placement?: string } {
  const type = response.headers.get('content-type') ?? '';
  const bodyKind =
    text === undefined
      ? 'unread'
      : text === ''
        ? 'empty'
        : type.includes('html')
          ? 'html'
          : type.includes('json')
            ? 'json'
            : type.startsWith('text/')
              ? 'text'
              : type
                ? 'other'
                : 'untyped';
  const placement = response.headers.get('cf-placement') ?? undefined;
  return {
    bodyKind,
    ...(text === undefined ? {} : { bodyBytes: text.length }),
    ...(placement && { placement }),
  };
}

/**
 * Cloudflare's own answer for a Worker that failed reads "error code: 1102" (resources exceeded),
 * "1101" (threw) and so on: the code says why, and is all of the body that reaches telemetry.
 */
export function cloudflareErrorOf(body: string | undefined): string | undefined {
  const code = body?.match(/error code:?\s*(\d{3,4})/i)?.[1];
  return code ? `cf_${code}` : undefined;
}

/**
 * Like `callApiRaw`, for callers that only want a success: null on a refusal as well, so the caller
 * keeps its own path: the web Worker stays the default and the api is the opt-in (Trello #120,
 * strangler).
 */
export async function callApi<T>(
  env: App.Locals['env'],
  path: string,
  actorId: string,
  log: Logger = logger,
): Promise<T | null> {
  const answer = await callApiRaw(env, path, actorId, log);
  if (!answer) return null;
  if (!answer.ok) {
    log.warn('api.call_refused', {
      code: 'api_call_refused',
      apiRoute: routeTemplate(path),
      status: answer.status,
      reason: (answer.body as { error?: unknown } | null)?.error as string | undefined,
    });
    return null;
  }
  return answer.body as T;
}
