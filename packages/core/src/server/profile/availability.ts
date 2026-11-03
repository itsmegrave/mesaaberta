import { eq } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { profiles } from '../db/schema';
import { recordEvent } from '../events/outbox';
import {
  availabilityMask,
  availabilitySlots,
  type AvailabilityInput,
} from '../../profile/availability';

/** The person's own "Quando posso jogar", as slots. */
export async function availabilityOf(db: AnyDb, profileId: string) {
  const [row] = await db
    .select({ availability: profiles.availability })
    .from(profiles)
    .where(eq(profiles.id, profileId));
  return { slots: availabilitySlots(row?.availability ?? 0) };
}

/** Saves "Quando posso jogar" (no slots clears it) and records `AvailabilityChanged`. */
export async function setAvailability(db: AnyDb, profileId: string, input: AvailabilityInput) {
  const availability = availabilityMask(input.slots);
  await db.update(profiles).set({ availability }).where(eq(profiles.id, profileId));
  const eventId = await recordEvent(db, {
    type: 'AvailabilityChanged',
    actorId: profileId,
    payload: { profileId, slots: availabilitySlots(availability).length },
  });
  return { eventIds: [eventId] };
}
