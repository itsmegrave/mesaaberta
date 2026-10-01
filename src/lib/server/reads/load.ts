import type { RequestEvent } from '@sveltejs/kit';
import { createQueryClient } from '$lib/query/client';
import {
  readKey,
  readParams,
  privateResources,
  type Resource,
  type ReadSeed,
} from '$lib/query/keys';
import { read as preview } from './preview';
import { read as tables } from './tables';
import { read as detail } from './detail';
import { read as dashboard } from './dashboard';
import { read as manage } from './manage';
import { read as catalog } from './catalog';
import { read as editCatalog } from './edit-catalog';
import { read as account } from './account';
import { read as admin } from './admin';
import { read as adminUsers } from './admin-users';
import { read as adminTables } from './admin-tables';
export const readers = {
  preview,
  tables,
  detail,
  dashboard,
  manage,
  catalog,
  editCatalog,
  account,
  admin,
  adminUsers,
  adminTables,
};
export type ReadData<R extends Resource> = Awaited<ReturnType<(typeof readers)[R]>>;
export async function loadRead<R extends Resource>(
  event: RequestEvent,
  resource: R,
): Promise<ReadData<R> & { readSeed: ReadSeed }> {
  const viewer = privateResources.has(resource)
    ? ((await event.locals.getUser())?.id ?? 'anonymous')
    : 'public';
  const seed = { resource, viewer, params: readParams(resource, event.url, event.params.slug) };
  const client = createQueryClient();
  try {
    const data = await client.fetchQuery({
      queryKey: readKey(seed),
      queryFn: () => (readers[resource] as (event: RequestEvent) => Promise<ReadData<R>>)(event),
      retry: false,
    });
    return {
      ...data,
      readSeed: {
        ...seed,
        fields: Object.keys(data),
        updatedAt: client.getQueryState(readKey(seed))!.dataUpdatedAt,
      },
    } as ReadData<R> & { readSeed: ReadSeed };
  } finally {
    client.clear();
  }
}
