import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { notifications, platforms, profiles, tags } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { catalogHandler } from './catalog';
import type { DomainEvent, StoredEvent } from './types';

let test: Awaited<ReturnType<typeof createTestDb>>;
const gm = '00000000-0000-4000-8000-000000000b01';
const admin = '00000000-0000-4000-8000-000000000b02';
const platformId = '00000000-0000-4000-8000-000000000b10';
const tagId = '00000000-0000-4000-8000-000000000b11';
const ownTagId = '00000000-0000-4000-8000-000000000b12';
const seededTagId = '00000000-0000-4000-8000-000000000b13';
let sequence = 0;

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: gm, username: 'mestre' },
    { id: admin, username: 'admin' },
  ]);
  await test.db.insert(platforms).values({
    id: platformId,
    name: 'Owlbear',
    slug: 'owlbear',
    status: 'pending',
    suggestedBy: gm,
  });
  await test.db.insert(tags).values([
    { id: tagId, name: 'Gore', slug: 'gore', status: 'pending', suggestedBy: gm },
    { id: ownTagId, name: 'Meu', slug: 'meu', status: 'pending', suggestedBy: admin },
    { id: seededTagId, name: 'Terror', slug: 'terror-x', status: 'approved' },
  ]);
});
afterAll(() => test.close());
beforeEach(async () => {
  await test.db.delete(notifications);
});

const stored = (event: DomainEvent, actorId: string): StoredEvent => ({
  ...event,
  id: `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
  actorId,
  createdAt: new Date('2026-10-01T12:00:00Z'),
  attempts: 0,
});
const handle = (event: StoredEvent) => catalogHandler.handle(event, test.db);
const written = async () =>
  (await test.db.select().from(notifications)).map((row) => ({
    to: row.recipientId,
    type: row.type,
    metadata: row.metadata,
  }));

describe('catalogHandler', () => {
  it('tells the GM who suggested a tag that an admin turned it down', async () => {
    await handle(
      stored(
        { type: 'CatalogEntryRejected', payload: { kind: 'tag', entryId: tagId, name: 'Gore' } },
        admin,
      ),
    );

    expect(await written()).toEqual([
      { to: gm, type: 'catalog_suggestion_rejected', metadata: { kind: 'tag', name: 'Gore' } },
    ]);
  });

  it('names the entry a suggestion was merged into', async () => {
    await handle(
      stored(
        {
          type: 'CatalogEntryMerged',
          payload: {
            kind: 'platform',
            entryId: platformId,
            name: 'Owlbear',
            into: 'Owlbear Rodeo',
          },
        },
        admin,
      ),
    );

    expect(await written()).toEqual([
      {
        to: gm,
        type: 'catalog_suggestion_merged',
        metadata: { kind: 'platform', name: 'Owlbear', into: 'Owlbear Rodeo' },
      },
    ]);
  });

  it('tells the GM an approval too, once for a retry', async () => {
    const event = stored(
      { type: 'CatalogEntryApproved', payload: { kind: 'tag', entryId: tagId, name: 'Gore' } },
      admin,
    );
    await handle(event);
    await handle(event);

    expect((await written()).map((row) => row.type)).toEqual(['catalog_suggestion_approved']);
  });

  it('tells nobody when the admin decided on their own suggestion, or no one suggested it', async () => {
    await handle(
      stored(
        { type: 'CatalogEntryApproved', payload: { kind: 'tag', entryId: ownTagId, name: 'Meu' } },
        admin,
      ),
    );
    await handle(
      stored(
        {
          type: 'CatalogEntryRejected',
          payload: { kind: 'tag', entryId: seededTagId, name: 'Terror' },
        },
        admin,
      ),
    );

    expect(await written()).toEqual([]);
  });
});
