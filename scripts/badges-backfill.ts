// Gives existing members the badges their history earned, without notifying anyone.
// Usage: bun run badges:backfill [--apply] [--pioneer-before=YYYY-MM-DD]
// Without --apply it only prints how many members would get each badge. Needs DATABASE_URL (see
// .dev.vars.example): it changes whatever database it points at, so check before using --apply.
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { backfillBadges } from '@mesaaberta/core/server/badges/backfill';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set. Copy .dev.vars.example to .dev.vars.');
const usage = 'Usage: bun run badges:backfill [--apply] [--pioneer-before=YYYY-MM-DD]';

let apply = false;
let pioneerBefore: Date | undefined;
for (const arg of process.argv.slice(2)) {
  if (arg === '--apply') apply = true;
  else if (arg.startsWith('--pioneer-before=')) {
    const value = arg.slice('--pioneer-before='.length);
    pioneerBefore = new Date(`${value}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(pioneerBefore.getTime()))
      throw new Error(usage);
  } else throw new Error(usage);
}

const client = postgres(url, { max: 1 });
try {
  const summary = await backfillBadges(drizzle(client), { apply, pioneerBefore });
  console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry_run', ...summary }, null, 2));
} finally {
  await client.end();
}
