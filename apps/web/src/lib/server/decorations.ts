import { MAX_DECORATED } from '@mesaaberta/core/server/extensions/index';
import type { DecorationsResponse } from '#lib/query/decorations.js';
import { readFromApi } from './api-read';

/** The decorations of these people, read by the api as a visitor: they are public. */
export async function decorationsFor(locals: App.Locals, usernames: readonly string[]) {
  const asked = [...new Set(usernames.map((name) => name.trim().toLowerCase()).filter(Boolean))];
  if (!asked.length) return {};
  const { decorations } = await readFromApi<DecorationsResponse>(
    locals,
    null,
    `/v1/decorations?u=${asked.slice(0, MAX_DECORATED).map(encodeURIComponent).join(',')}`,
  );
  return decorations;
}
