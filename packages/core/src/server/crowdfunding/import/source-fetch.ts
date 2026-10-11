import { isSafeTarget, resolveOverHttps, type Fetcher, type Resolver } from '../link-preview';
import { sourceUrlAllowed } from './candidate';
import type { ImportSource, SourceReader } from './types';
type Deps = { fetcher?: Fetcher; resolve?: Resolver; timeoutMs?: number };
/** An HTML source read owns its deadline through streaming, including DNS and redirects. */
export function sourceReader(
  source: ImportSource,
  { fetcher = fetch, resolve = resolveOverHttps(fetcher), timeoutMs = 15_000 }: Deps = {},
): SourceReader {
  return async (start) => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('source_timeout'));
      }, timeoutMs);
    });
    const work = async () => {
      let url = new URL(start);
      for (let hop = 0; hop <= 3; hop++) {
        if (!sourceUrlAllowed(url.href, source) || !(await isSafeTarget(url, resolve)))
          throw new Error('source_unsafe_url');
        const response = await fetcher(url.href, {
          redirect: 'manual',
          headers: {
            accept: 'text/html',
            'user-agent': 'MesaAbertaCampaignImporter/1.0 (+https://mesaaberta.app)',
          },
          signal: controller.signal,
        });
        if (response.status >= 300 && response.status < 400) {
          const to = response.headers.get('location');
          await response.body?.cancel();
          if (!to) throw new Error('source_redirect');
          url = new URL(to, url);
          continue;
        }
        if (!response.ok) {
          await response.body?.cancel();
          const error = new Error(`source_http_${response.status}`) as Error & {
            retryAfterMs?: number;
          };
          const retry = response.headers.get('retry-after');
          if (retry) {
            const seconds = Number(retry);
            error.retryAfterMs = Number.isFinite(seconds)
              ? Math.max(0, seconds * 1000)
              : Math.max(0, Date.parse(retry) - Date.now());
          }
          throw error;
        }
        if (!/^text\/html\b/i.test(response.headers.get('content-type') ?? '')) {
          await response.body?.cancel();
          throw new Error('source_content_type');
        }
        const limit = 2 * 1024 * 1024;
        if (Number(response.headers.get('content-length')) > limit) {
          await response.body?.cancel();
          throw new Error('source_size');
        }
        if (!response.body) throw new Error('source_empty');
        const reader = response.body.getReader();
        let length = 0;
        const chunks: Uint8Array[] = [];
        const abort = () => {
          void reader.cancel().catch(() => undefined);
        };
        controller.signal.addEventListener('abort', abort, { once: true });
        try {
          for (;;) {
            if (controller.signal.aborted) throw new Error('source_timeout');
            const { done, value } = await reader.read();
            if (done) break;
            length += value.byteLength;
            if (length > limit) {
              await reader.cancel();
              throw new Error('source_size');
            }
            chunks.push(value);
          }
          if (controller.signal.aborted) throw new Error('source_timeout');
        } finally {
          controller.signal.removeEventListener('abort', abort);
          reader.releaseLock();
        }
        const bytes = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }
        return new TextDecoder().decode(bytes);
      }
      throw new Error('source_redirect');
    };
    const retry = async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          return await work();
        } catch (error) {
          if (
            controller.signal.aborted ||
            attempt >= 2 ||
            !(
              error instanceof TypeError ||
              (error instanceof Error && /^source_http_(429|5\d\d)$/.test(error.message))
            )
          )
            throw error;
          const delay =
            (error as Error & { retryAfterMs?: number }).retryAfterMs ?? 500 * (attempt + 1);
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(done, delay);
            function done() {
              controller.signal.removeEventListener('abort', abort);
              resolve();
            }
            function abort() {
              clearTimeout(timer);
              reject(new Error('source_timeout'));
            }
            controller.signal.addEventListener('abort', abort, { once: true });
          });
        }
      }
    };
    try {
      return await Promise.race([retry(), timeout]);
    } finally {
      clearTimeout(timer);
    }
  };
}
