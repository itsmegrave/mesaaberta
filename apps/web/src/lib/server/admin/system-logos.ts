import { Invalid } from '@mesaaberta/core/server/errors';
import { IMAGE_BUCKET, prepareImage, storeImage } from '@mesaaberta/core/server/images';
import { isInside, serverStorage } from '@mesaaberta/core/server/storage';
import { LOGO_FOLDER } from '@mesaaberta/core/server/systems/logos/service';
import { requireApi } from '../api-required';

const API = '/v1/admin/system-logos';

type Admin = { id: string };
type Locals = App.Locals;

/** Deletes logo files the api no longer points at. Best effort: a leftover file is harmless. */
async function removeFiles(locals: Locals, paths: (string | null | undefined)[]) {
  const ours = paths.filter((path): path is string => !!path && isInside(path, LOGO_FOLDER));
  if (ours.length === 0) return;
  const { error } = (await serverStorage(locals.env, IMAGE_BUCKET)?.remove(ours)) ?? {};
  if (error) locals.log.warn('storage.system_logo_delete_failed', { error });
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
