import { GM_MODALITIES } from '@mesaaberta/core/gms/directory-filters';
import { m } from '#lib/paraglide/messages.js';

const DAY_MS = 86_400_000;

/** When the person last ran a table, against `now`: "última hoje", "última há 12 dias", "última há 3 meses". */
export function lastRunLabel(lastRunAt: Date | string, now: Date): string {
  const days = Math.max(0, Math.floor((now.getTime() - new Date(lastRunAt).getTime()) / DAY_MS));
  return days < 60
    ? m.gms_last_run_days({ count: days })
    : m.gms_last_run_months({ count: Math.floor(days / 30) });
}

type Facts = {
  tables: number;
  lastRunAt: Date | string | null;
  modalities: readonly ('online' | 'in_person')[];
  city: string | null;
};

/** The card's line of facts: "5 mesas mestradas · última há 12 dias · Online / Presencial · Recife". */
export function gmFacts(gm: Facts, now: Date): string {
  const where = GM_MODALITIES.filter((modality) => gm.modalities.includes(modality))
    .map((modality) =>
      modality === 'online' ? m.gms_modality_online() : m.gms_modality_in_person(),
    )
    .join(' / ');
  return [
    m.gms_tables_run({ count: gm.tables }),
    gm.lastRunAt ? lastRunLabel(gm.lastRunAt, now) : '',
    where,
    gm.city ?? '',
  ]
    .filter(Boolean)
    .join(' · ');
}
