// Development data: one GM and a few tables. The RPG systems themselves come from the migrations. Safe to run again; existing rows are left alone.
// Usage: bun run db:seed (needs DATABASE_URL, see .dev.vars.example)
import { eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  gameTablePlatforms,
  gameTables,
  gameTableTags,
  platforms,
  tags,
  profiles,
  registrations,
  systems,
} from '../src/lib/server/db/schema.ts';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set. Copy .dev.vars.example to .dev.vars.');

const client = postgres(url, { max: 1 });
const db = drizzle(client);

const gm = {
  id: '00000000-0000-4000-8000-000000000001',
  username: 'mestre-de-testes',
  name: 'Mestre de Testes',
};

const inDays = (days: number, hour: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
};

const base = { timezone: 'America/Sao_Paulo', durationMinutes: 240, gmId: gm.id };

const systemId = async (slug: string) => {
  const [system] = await db.select({ id: systems.id }).from(systems).where(eq(systems.slug, slug));
  if (!system) throw new Error(`No system "${slug}". Run bun run db:migrate first.`);
  return system.id;
};

await db.insert(profiles).values(gm).onConflictDoNothing();

const tables = [
  {
    ...base,
    slug: 'os-sinos-de-sablewood',
    title: 'Os Sinos de Sablewood',
    systemId: await systemId('daggerheart'),
    kind: 'one_shot' as const,
    capacity: 5,
    startsAt: inDays(7, 22),
    description:
      '<p>Uma aventura de uma noite para quem nunca jogou.<br>Não precisa de experiência.</p>',
    // Rich text, with a script on purpose: the page keeps the formatting and drops what could run.
    extraInfo: '<p>Traga dados e <strong>lápis</strong>.<script>window.__xss = true</script></p>',
  },
  {
    ...base,
    slug: 'cronicas-de-roshar',
    title: 'Crônicas de Roshar',
    systemId: await systemId('cosmere-roleplaying-game'),
    kind: 'campaign' as const,
    recurrence: 'FREQ=WEEKLY',
    capacity: 4,
    startsAt: inDays(3, 21),
    joinMode: 'approval' as const,
  },
  {
    ...base,
    slug: 'noites-de-neon',
    title: 'Noites de Neon',
    systemId: await systemId('urban-shadows-2e'),
    kind: 'one_shot' as const,
    capacity: 4,
    startsAt: inDays(10, 22),
    modality: 'in_person' as const,
    locationArea: 'Boa Viagem, Recife - PE',
  },
  {
    ...base,
    slug: 'a-cripta-do-rei-afogado',
    title: 'A Cripta do Rei Afogado',
    systemId: await systemId('old-dragon-2-edicao'),
    kind: 'one_shot' as const,
    capacity: 5,
    startsAt: inDays(12, 22),
  },
  {
    ...base,
    slug: 'a-ultima-estrada',
    title: 'A Última Estrada',
    systemId: await systemId('savage-worlds'),
    kind: 'one_shot' as const,
    capacity: 4,
    startsAt: inDays(5, 20),
    // The public pages must never show a disabled table.
    status: 'disabled' as const,
  },
];

// The platforms and tags of each seeded table, by slug (the catalog comes from a migration).
const picks: Record<string, { platforms: string[]; tags: string[] }> = {
  'os-sinos-de-sablewood': {
    platforms: ['discord', 'foundry-vtt'],
    tags: ['iniciantes', 'alta-fantasia'],
  },
  'cronicas-de-roshar': {
    platforms: ['discord'],
    tags: ['roleplay', 'intriga-politica', 'exploracao'],
  },
  'noites-de-neon': { platforms: [], tags: ['terror', 'mesa-segura'] },
  'a-cripta-do-rei-afogado': {
    platforms: ['owlbear-rodeo', 'discord'],
    tags: ['dungeon-crawl', 'sobrevivencia'],
  },
  'a-ultima-estrada': { platforms: ['roll20'], tags: ['pos-apocaliptico'] },
};

const idsOf = async (table: typeof platforms | typeof tags, slugs: string[]) =>
  slugs.length === 0
    ? []
    : (
        await db
          .select({ id: table.id, slug: table.slug })
          .from(table)
          .where(inArray(table.slug, slugs))
      )
        .sort((a, b) => slugs.indexOf(a.slug) - slugs.indexOf(b.slug))
        .map((row) => row.id);

// Running it again moves the sessions back to the days above, so the dates never go stale.
for (const table of tables) {
  const [row] = await db
    .insert(gameTables)
    .values(table)
    .onConflictDoUpdate({ target: gameTables.slug, set: { startsAt: table.startsAt } })
    .returning({ id: gameTables.id });

  // Seeded tables start empty on every run, so tests that count their seats do not depend on order.
  await db.delete(registrations).where(eq(registrations.tableId, row.id));
  const pick = picks[table.slug];
  await db.delete(gameTablePlatforms).where(eq(gameTablePlatforms.tableId, row.id));
  await db.delete(gameTableTags).where(eq(gameTableTags.tableId, row.id));
  const platformIds = await idsOf(platforms, pick.platforms);
  const tagIds = await idsOf(tags, pick.tags);
  if (platformIds.length > 0) {
    await db
      .insert(gameTablePlatforms)
      .values(
        platformIds.map((platformId, position) => ({ tableId: row.id, platformId, position })),
      );
  }
  if (tagIds.length > 0) {
    await db
      .insert(gameTableTags)
      .values(tagIds.map((tagId, position) => ({ tableId: row.id, tagId, position })));
  }
}

await client.end();
console.log(`Dev data is in place: 1 profile and ${tables.length} tables (one disabled).`);
