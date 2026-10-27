import type { exportAccount } from '@mesaaberta/core/server/account/service';
import { readFromApi } from '#lib/server/api-read.js';
import { requireUser } from '#lib/server/auth/guard.js';
import type { RequestHandler } from './$types';

// The data portability right (LGPD art. 18, V): a JSON file with everything the account holds.
export const GET: RequestHandler = async ({ locals, url }) => {
  const user = await requireUser(locals, url);

  // The api Worker gathers it; the e-mail is the account's own, from Auth.
  const data = await readFromApi<Awaited<ReturnType<typeof exportAccount>>>(
    locals,
    user.id,
    `/v1/me/export?email=${encodeURIComponent(user.email ?? '')}`,
  );
  const day = data.exportedAt.slice(0, 10);

  return Response.json(data, {
    headers: {
      'content-disposition': `attachment; filename="mesa-aberta-dados-${day}.json"`,
      'cache-control': 'no-store',
    },
  });
};
