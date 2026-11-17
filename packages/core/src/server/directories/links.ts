import type { AnyDb } from '../db/client';
import { placeCardsOf, type PlaceCard } from '../places/directory';
import { placeIdsOfPartner, shownGmsOf, type ShownGm } from '../places/partner-links';

/** What a partner's page adds below its card: its places ("Onde jogar") and "Quem mestra". */
export type PartnerConnections = { places: PlaceCard[]; gms: ShownGm[] };

export async function partnerConnections(
  db: AnyDb,
  partnerId: string,
  now: Date,
): Promise<PartnerConnections> {
  const [places, gms] = await Promise.all([
    placeIdsOfPartner(db, partnerId).then((ids) => placeCardsOf(db, ids, now)),
    shownGmsOf(db, [partnerId]),
  ]);
  return { places, gms };
}
