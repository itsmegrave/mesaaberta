// Read-only: runs the production logo finder over the seeded systems and prints what it would
// propose, one JSON line per system, then a summary. No database, no storage, no image download.
//   bun run logos:dry-run [limit] [offset]
import { readFileSync } from 'node:fs';
import { findSystemLogo } from '@mesaaberta/core/server/systems/logos/finder';

const limit = Number(process.argv[2]) || Infinity;
const offset = Number(process.argv[3]) || 0;
const seed = readFileSync(new URL('../drizzle/0001_rpg_systems.sql', import.meta.url), 'utf8');
// The seed's rows read `('Name', 'slug', position),`, with '' for a quote in a name.
const names = [...seed.matchAll(/^\s*\('((?:[^']|'')*)', '([^']*)', (\d+)\)/gm)]
  .map((row) => ({ name: row[1].replace(/''/g, "'"), slug: row[2] }))
  .slice(offset, offset + limit);

const counts: Record<string, number> = {};
const queue = [...names];
async function worker() {
  for (let system = queue.shift(); system; system = queue.shift()) {
    const found = await findSystemLogo(system.name);
    const key = found.candidate
      ? `${found.candidate.method}:${found.candidate.confidence}`
      : `none:${found.reason}`;
    counts[key] = (counts[key] ?? 0) + 1;
    console.log(JSON.stringify({ ...system, ...found }));
  }
}
// A few at a time: Wikidata asks bots to keep it gentle.
await Promise.all(Array.from({ length: 3 }, worker));
console.error(JSON.stringify({ outcome: 'dry_run', systems: names.length, counts }));
