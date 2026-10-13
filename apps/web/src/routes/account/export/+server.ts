import { error, json } from '@sveltejs/kit';
import { exportAccount } from '$lib/server/account/service';
import { requireUser } from '$lib/server/auth/guard';
import type { RequestHandler } from './$types';

// The data portability right (LGPD art. 18, V): a JSON file with everything the account holds.
export const GET: RequestHandler = async ({ locals, url }) => {
  const user = await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');

  const data = await exportAccount(locals.db, user.id, user.email ?? '');
  const day = data.exportedAt.slice(0, 10);

  return json(data, {
    headers: {
      'content-disposition': `attachment; filename="mesa-aberta-dados-${day}.json"`,
      'cache-control': 'no-store',
    },
  });
};
