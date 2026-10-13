import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { openIntegrationDb } from '../../db/integration-db';
import {
  crowdfundingImports,
  crowdfundingImportRuns,
  crowdfundings,
  events,
  profiles,
} from '../../db/schema';
import { addCrowdfunding } from '../service';
import { claimRun, finishRun, importCandidate } from './store';
import type { SourceCandidate } from './types';
const { db, close } = openIntegrationDb();
const actor = { id: crypto.randomUUID(), role: 'member' as const, status: 'active' as const };
const now = new Date('2026-10-08T04:00:00Z');
const ids: string[] = [];
const c = (): SourceCandidate => {
  const id = crypto.randomUUID();
  ids.push(id);
  return {
    source: 'catarse',
    externalId: id,
    url: `https://catarse.com.br/${id}`,
    name: 'RPG race',
    owner: 'Editora',
    startsOn: '2026-10-01',
    endsOn: '2026-11-01',
    imageUrl: null,
  };
};
beforeAll(async () => {
  await db.insert(profiles).values({ id: actor.id, username: `import${actor.id.slice(0, 8)}` });
});
afterAll(async () => {
  await db.delete(crowdfundingImports).where(inArray(crowdfundingImports.externalId, ids));
  await db.delete(crowdfundings).where(
    inArray(
      crowdfundings.url,
      ids.flatMap((id) => [`https://catarse.com.br/${id}`, `https://catarse.me/${id}`]),
    ),
  );
  await db.delete(events).where(
    sql`${events.payload}->>'externalId' IN (${sql.join(
      ids.map((id) => sql`${id}`),
      sql`,`,
    )})`,
  );
  await db.delete(events).where(eq(events.actorId, actor.id));
  await db.delete(profiles).where(eq(profiles.id, actor.id));
  await db
    .delete(crowdfundingImportRuns)
    .where(
      and(
        eq(crowdfundingImportRuns.source, 'catarse'),
        eq(crowdfundingImportRuns.runDate, '2099-10-08'),
      ),
    );
  await close();
});
describe('import races on independent PostgreSQL connections', () => {
  it('two imports produce one catalog row and audit event', async () => {
    const candidate = c();
    expect(
      (
        await Promise.all([
          importCandidate(db, candidate, { now }),
          importCandidate(db, candidate, { now }),
        ])
      ).sort(),
    ).toEqual(['existing', 'imported']);
    expect(
      await db.select().from(crowdfundings).where(eq(crowdfundings.url, candidate.url)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(events)
        .where(sql`${events.payload}->>'externalId'=${candidate.externalId}`),
    ).toHaveLength(1);
  });
  it('a member submission racing an import uses the same lock across domain aliases', async () => {
    const candidate = c();
    await Promise.allSettled([
      importCandidate(db, candidate, { now }),
      addCrowdfunding(
        db,
        actor,
        { ...candidate, url: candidate.url.replace('catarse.com.br', 'catarse.me') },
        { now },
      ),
    ]);
    expect(
      await db
        .select()
        .from(crowdfundings)
        .where(
          inArray(crowdfundings.url, [
            candidate.url,
            candidate.url.replace('catarse.com.br', 'catarse.me'),
          ]),
        ),
    ).toHaveLength(1);
  });
  it('claims once and prevents stale lease finalization', async () => {
    const results = await Promise.all([
      claimRun(db, 'catarse', '2099-10-08', now),
      claimRun(db, 'catarse', '2099-10-08', now),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const later = new Date(+now + 10 * 60_000),
      next = await claimRun(db, 'catarse', '2099-10-08', later);
    expect(next).not.toBeNull();
    expect(await finishRun(db, results.find(Boolean)!, 'complete', null, {}, later)).toBe(false);
    expect(await finishRun(db, next!, 'complete', null, {}, later)).toBe(true);
  });
});
