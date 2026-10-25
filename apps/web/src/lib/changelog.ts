import entries from '../content/changelog.json' with { type: 'json' };

export type ChangeKind = 'new' | 'improved' | 'fixed';
export type Change = { kind: ChangeKind; title: string; description: string; href?: string };
export type Release = {
  preview?: 'chat' | 'password';
  date: string;
  title: string;
  summary: string;
  changes: Change[];
};
export const releases = entries as Release[];
export const PAGE_SIZE = 5;
export const kinds: ChangeKind[] = ['new', 'improved', 'fixed'];

/** Filter before pagination, keeping a release day together and its address stable. */
export function releasePage(type: string | null, requestedPage: string | null) {
  const kind = kinds.find((kind) => kind === type) ?? null;
  const filtered = releases
    .map((release) => ({
      ...release,
      changes: release.changes.filter((change) => !kind || change.kind === kind),
    }))
    .filter((release) => release.changes.length > 0);
  const page = requestedPage && /^[1-9]\d*$/.test(requestedPage) ? Number(requestedPage) : 1;
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  return {
    kind,
    page,
    pages,
    entries: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    highlights: releases.slice(0, 3),
    counts: {
      all: releases.flatMap((release) => release.changes).length,
      ...Object.fromEntries(
        kinds.map((kind) => [
          kind,
          releases.flatMap((release) => release.changes).filter((change) => change.kind === kind)
            .length,
        ]),
      ),
    } as Record<'all' | ChangeKind, number>,
  };
}

export function releaseHref(date: string): `/changelog${string}` {
  const page = Math.floor(releases.findIndex((release) => release.date === date) / PAGE_SIZE) + 1;
  return `/changelog${page > 1 ? `?page=${page}` : ''}#${date}`;
}
