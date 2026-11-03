import type { PersonDecorations } from '@mesaaberta/core/server/extensions/contract';
import { apiRead } from '#lib/api/http.js';

/** One person's decorations (see `/api/decorations`), by lowercase username. */
export const decorationKey = (username: string) => ['decorations', username] as const;

export type DecorationsResponse = { decorations: Record<string, PersonDecorations> };

/** How many people one request asks about; mirrors `MAX_DECORATED` in core. */
const BATCH = 60;

type Waiting = { resolve: (found: PersonDecorations) => void; reject: (error: unknown) => void };
let pending = new Map<string, Waiting[]>();
let scheduled = false;

async function flush(read: typeof apiRead) {
  const batch = pending;
  pending = new Map();
  scheduled = false;
  const names = [...batch.keys()];
  for (let start = 0; start < names.length; start += BATCH) {
    const chunk = names.slice(start, start + BATCH);
    try {
      const { decorations } = await read<DecorationsResponse>(
        `/api/decorations?u=${chunk.map(encodeURIComponent).join(',')}`,
      );
      for (const name of chunk)
        for (const waiting of batch.get(name) ?? []) waiting.resolve(decorations[name] ?? {});
    } catch (error) {
      for (const name of chunk) for (const waiting of batch.get(name) ?? []) waiting.reject(error);
    }
  }
}

/**
 * One person's decorations. The avatars drawn in the same moment (a directory page, a roster) are
 * asked about together, in one request.
 */
export function loadDecorations(
  username: string,
  read: typeof apiRead = apiRead,
): Promise<PersonDecorations> {
  const name = username.trim().toLowerCase();
  return new Promise((resolve, reject) => {
    const list = pending.get(name) ?? [];
    list.push({ resolve, reject });
    pending.set(name, list);
    if (!scheduled) {
      scheduled = true;
      queueMicrotask(() => void flush(read));
    }
  });
}
