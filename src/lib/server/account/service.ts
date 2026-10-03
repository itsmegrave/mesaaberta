import { and, asc, eq, inArray } from 'drizzle-orm';
import { eraseMessagesOf } from '../messages/service';
import type { AnyDb } from '../db/client';
import {
  conversations,
  gameTables,
  gmScores,
  messages,
  notifications,
  profileSocialLinks,
  profiles,
  ratings,
  registrations,
  systems,
} from '../db/schema';
import { recordEvent } from '../events/outbox';

/**
 * Everything the account holds, for the data portability right (LGPD art. 18, V). Only this
 * person's data: the players at their tables are left out, they are other people's data.
 */
export async function exportAccount(db: AnyDb, userId: string, email: string, now = new Date()) {
  const [profile] = await db
    .select({
      username: profiles.username,
      name: profiles.name,
      ageRange: profiles.ageRange,
      gender: profiles.gender,
      genderOther: profiles.genderOther,
      city: profiles.city,
      timezone: profiles.timezone,
      directMessagesEnabled: profiles.directMessagesEnabled,
      avatarUrl: profiles.avatarUrl,
      avatarPath: profiles.avatarPath,
      createdAt: profiles.createdAt,
    })
    .from(profiles)
    .where(eq(profiles.id, userId));

  const [socialLinks, tablesAsGm, seats, ratingsGiven, notificationsReceived, messagesSent] =
    await Promise.all([
      db
        .select({
          network: profileSocialLinks.network,
          handle: profileSocialLinks.handle,
          url: profileSocialLinks.url,
        })
        .from(profileSocialLinks)
        .where(eq(profileSocialLinks.profileId, userId))
        .orderBy(asc(profileSocialLinks.position)),
      db
        .select({
          slug: gameTables.slug,
          title: gameTables.title,
          system: systems.name,
          kind: gameTables.kind,
          status: gameTables.status,
          description: gameTables.description,
          extraInfo: gameTables.extraInfo,
          welcomeMessage: gameTables.welcomeMessage,
          modality: gameTables.modality,
          locationArea: gameTables.locationArea,
          joinDetails: gameTables.joinDetails,
          capacity: gameTables.capacity,
          joinMode: gameTables.joinMode,
          startsAt: gameTables.startsAt,
          durationMinutes: gameTables.durationMinutes,
          timezone: gameTables.timezone,
          recurrence: gameTables.recurrence,
          until: gameTables.until,
          createdAt: gameTables.createdAt,
        })
        .from(gameTables)
        .innerJoin(systems, eq(gameTables.systemId, systems.id))
        .where(eq(gameTables.gmId, userId))
        .orderBy(asc(gameTables.createdAt)),
      db
        .select({
          table: gameTables.title,
          slug: gameTables.slug,
          status: registrations.status,
          message: registrations.message,
          createdAt: registrations.createdAt,
        })
        .from(registrations)
        .innerJoin(gameTables, eq(registrations.tableId, gameTables.id))
        .where(eq(registrations.playerId, userId))
        .orderBy(asc(registrations.createdAt)),
      db
        .select({
          table: gameTables.title,
          slug: gameTables.slug,
          gmScore: ratings.gmScore,
          comment: ratings.comment,
          createdAt: ratings.createdAt,
        })
        .from(ratings)
        .innerJoin(gameTables, eq(ratings.tableId, gameTables.id))
        .where(eq(ratings.playerId, userId))
        .orderBy(asc(ratings.createdAt)),
      db
        .select({
          type: notifications.type,
          category: notifications.category,
          title: notifications.title,
          body: notifications.body,
          link: notifications.link,
          metadata: notifications.metadata,
          readAt: notifications.readAt,
          createdAt: notifications.createdAt,
        })
        .from(notifications)
        .where(eq(notifications.recipientId, userId))
        .orderBy(asc(notifications.createdAt)),
      // What the person wrote. The other people's messages are their data, so they are left out.
      db
        .select({
          kind: conversations.kind,
          table: gameTables.title,
          body: messages.body,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .innerJoin(conversations, eq(conversations.id, messages.conversationId))
        .leftJoin(gameTables, eq(gameTables.id, conversations.tableId))
        .where(eq(messages.senderId, userId))
        .orderBy(asc(messages.createdAt)),
    ]);

  return {
    exportedAt: now.toISOString(),
    account: { id: userId, email },
    profile: profile ?? null,
    socialLinks,
    tablesAsGm,
    seats,
    ratingsGiven,
    notifications: notificationsReceived,
    messagesSent,
  };
}

/**
 * The database side of deleting an account, in one transaction: the person's active tables are
 * disabled (each with a `TableDisabled` event, so the players get the calendar cancellation), their
 * seats go, and so do the ratings of the tables they ran, with the cached score. The ratings they gave
 * stay, final, and count for those GMs; only the comments go, with their other texts. A finished
 * table stays as it was. Returns the events to dispatch. Run it before the Auth user is deleted:
 * the cancellation mail looks up the GM's address.
 */
export async function closeAccount(db: AnyDb, userId: string): Promise<{ eventIds: string[] }> {
  const eventIds = await db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const active = await t
      .select({
        id: gameTables.id,
        slug: gameTables.slug,
        title: gameTables.title,
        icalSequence: gameTables.icalSequence,
      })
      .from(gameTables)
      .where(and(eq(gameTables.gmId, userId), eq(gameTables.status, 'active')));

    const ids: string[] = [];
    for (const table of active) {
      await t
        .update(gameTables)
        .set({ status: 'disabled', icalSequence: table.icalSequence + 1 })
        .where(eq(gameTables.id, table.id));
      ids.push(
        await recordEvent(t, {
          type: 'TableDisabled',
          actorId: userId,
          payload: { tableId: table.id, slug: table.slug, title: table.title },
        }),
      );
    }

    await t.delete(registrations).where(eq(registrations.playerId, userId));
    await t
      .delete(ratings)
      .where(
        inArray(
          ratings.tableId,
          t.select({ id: gameTables.id }).from(gameTables).where(eq(gameTables.gmId, userId)),
        ),
      );
    await t.delete(gmScores).where(eq(gmScores.gmId, userId));
    await t.update(ratings).set({ comment: null }).where(eq(ratings.playerId, userId));
    await eraseMessagesOf(t, userId);
    return ids;
  });

  return { eventIds };
}

/**
 * Clears every personal field of a closed account and its links and notifications. The row itself stays, empty, because
 * the disabled tables still point at it; it is suspended so nothing can act through it.
 */
export async function anonymiseProfile(db: AnyDb, userId: string) {
  await db.transaction(async (tx) => {
    await tx.delete(profileSocialLinks).where(eq(profileSocialLinks.profileId, userId));
    await tx.delete(notifications).where(eq(notifications.recipientId, userId));
    await tx
      .update(profiles)
      .set({
        username: null,
        name: null,
        ageRange: null,
        gender: null,
        genderOther: null,
        city: null,
        timezone: null,
        avatarUrl: null,
        avatarPath: null,
        status: 'suspended',
      })
      .where(eq(profiles.id, userId));
  });
}

/**
 * Points the profile at a newly uploaded picture, or at none (`null`: back to the provider's).
 * Returns the path it replaced, so the caller can delete that file.
 */
export async function setAvatarPath(
  db: AnyDb,
  userId: string,
  path: string | null,
): Promise<string | null> {
  return db.transaction(async (tx) => {
    const [before] = await tx
      .select({ avatarPath: profiles.avatarPath })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .for('update');
    await tx.update(profiles).set({ avatarPath: path }).where(eq(profiles.id, userId));
    return before?.avatarPath ?? null;
  });
}
