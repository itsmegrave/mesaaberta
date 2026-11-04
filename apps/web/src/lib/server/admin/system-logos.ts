import { readRemoteImage } from '@mesaaberta/core/server/crowdfunding/link-preview';
import { Invalid } from '@mesaaberta/core/server/errors';
import {
  IMAGE_BUCKET,
  detectImageType,
  prepareImage,
  storeImage,
} from '@mesaaberta/core/server/images';
import { isInside, serverStorage } from '@mesaaberta/core/server/storage';
import {
  findSystemLogo,
  type FinderDeps,
  type LogoCandidate,
} from '@mesaaberta/core/server/systems/logos/finder';
import { LOGO_FOLDER } from '@mesaaberta/core/server/systems/logos/service';
import { requireApi } from '../api-required';

const API = '/v1/admin/system-logos';
const EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as const;

type Admin = { id: string };
type Locals = App.Locals;

export type SearchOutcome = {
  name: string;
  slug: string;
  outcome: 'found' | 'missing' | 'image_unreadable';
  confidence: LogoCandidate['confidence'] | null;
};

/** Deletes logo files the api no longer points at. Best effort: a leftover file is harmless. */
async function removeFiles(locals: Locals, paths: (string | null | undefined)[]) {
  const ours = paths.filter((path): path is string => !!path && isInside(path, LOGO_FOLDER));
  if (ours.length === 0) return;
  const { error } = (await serverStorage(locals.env, IMAGE_BUCKET)?.remove(ours)) ?? {};
  if (error) locals.log.warn('storage.system_logo_delete_failed', { error });
}

/** Copies the candidate's picture into our storage. Null when it cannot be read or is not an image we take. */
async function storeCandidate(locals: Locals, candidate: LogoCandidate, deps: FinderDeps) {
  const storage = serverStorage(locals.env, IMAGE_BUCKET);
  if (!storage) throw new Invalid('image', 'upload_failed');
  const bytes = await readRemoteImage(candidate.imageUrl, deps);
  const contentType = bytes && detectImageType(bytes);
  if (!bytes || !contentType) return null;
  return storeImage(
    storage,
    {
      bytes,
      contentType,
      path: `${LOGO_FOLDER}/${crypto.randomUUID()}.${EXTENSIONS[contentType]}`,
    },
    locals.log,
  );
}

/**
 * One step of the logo search, for the admin page to repeat until nothing is left: the next few
 * systems the search has not looked at, each searched, its picture stored and the result recorded
 * through the api (`pending`, or `missing` with why). Answers what happened to each, and whether
 * there are more.
 */
export async function searchNextLogos(
  locals: Locals,
  admin: Admin,
  deps: FinderDeps = {},
): Promise<{
  searched: SearchOutcome[];
  more: boolean;
  failed?: true;
  /** Seconds Wikimedia asked to wait before the next step, when it asked. */
  retryAfter?: number;
}> {
  const { systems } = await requireApi<{ systems: { id: string; name: string; slug: string }[] }>(
    locals,
    admin,
    `${API}/to-search`,
  );
  const searched: SearchOutcome[] = [];
  for (const system of systems) {
    const search = await findSystemLogo(system.name, deps);
    // Wikidata did not answer: record nothing (the system stays to be searched) and stop here, so
    // an outage never marks every system as missing.
    if (search.reason === 'lookup_failed') {
      locals.log.warn('system_logos.lookup_failed', { code: 'lookup_failed' });
      return { searched, more: false, failed: true, retryAfter: search.retryAfter };
    }
    const path = search.candidate ? await storeCandidate(locals, search.candidate, deps) : null;
    const found =
      search.candidate && path
        ? {
            path,
            method: search.candidate.method,
            confidence: search.candidate.confidence,
            imageUrl: search.candidate.imageUrl,
            sourcePage: search.candidate.sourcePage,
            attribution: search.candidate.attribution?.slice(0, 500) ?? null,
            license: search.candidate.license?.slice(0, 200) ?? null,
            note: search.candidate.note,
            wikidataId: search.wikidataId,
          }
        : null;
    const reason = found
      ? null
      : search.candidate
        ? `image_unreadable: ${search.candidate.imageUrl}`.slice(0, 200)
        : search.reason;
    const { unused } = await requireApi<{ unused: string | null }>(locals, admin, `${API}/record`, {
      method: 'POST',
      body: { systemId: system.id, found, reason, wikidataId: search.wikidataId },
    });
    await removeFiles(locals, [unused]);
    searched.push({
      name: system.name,
      slug: system.slug,
      outcome: found ? 'found' : search.candidate ? 'image_unreadable' : 'missing',
      confidence: found?.confidence ?? null,
    });
  }
  return { searched, more: systems.length > 0 };
}

/** An admin's decision on one logo (or on all the sure ones); deletes the file it frees. */
export async function decideLogo(
  locals: Locals,
  admin: Admin,
  action: 'approve' | 'approveSure' | 'reject' | 'forget' | 'forgetMissing',
  systemId?: string,
) {
  const answer = await requireApi<{
    removed?: string | null;
    approved?: number;
    forgotten?: number;
  }>(locals, admin, `${API}/${action}`, { method: 'POST', body: systemId ? { systemId } : {} });
  await removeFiles(locals, [answer.removed]);
  return answer;
}

/** A logo the admin sends by hand, with where it comes from. Approved as sent. */
export async function uploadLogo(
  locals: Locals,
  admin: Admin,
  {
    systemId,
    logo,
    sourcePage,
    attribution,
  }: { systemId: string; logo: File; sourcePage: string; attribution: string },
) {
  const prepared = await prepareImage(logo, LOGO_FOLDER);
  const storage = serverStorage(locals.env, IMAGE_BUCKET);
  if (!storage) throw new Invalid('image', 'upload_failed');
  const path = await storeImage(storage, prepared, locals.log);
  try {
    const { replaced } = await requireApi<{ replaced: string | null }>(
      locals,
      admin,
      `${API}/upload`,
      { method: 'POST', body: { systemId, path, sourcePage, attribution: attribution || null } },
    );
    await removeFiles(locals, [replaced]);
  } catch (error) {
    // Not recorded: the file would be left with nothing pointing at it.
    await removeFiles(locals, [path]);
    throw error;
  }
}
