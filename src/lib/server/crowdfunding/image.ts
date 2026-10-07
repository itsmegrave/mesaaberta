import {
  detectImageType,
  prepareImage,
  storeImage,
  type ImageStorage,
  type PreparedImage,
} from '../images';
import { Invalid } from '../errors';
import type { Logger } from '../logger';
import { readRemoteImage, type Fetcher, type Resolver } from './link-preview';

const TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as const;
const FOLDER = 'crowdfunding';

/**
 * The picture a campaign is stored with, in the order the form promises: the file the member
 * uploaded, else the campaign page's own picture (`og:image`, copied into our storage so the CSP
 * `img-src` stays as it is and the picture does not break when the other site moves it), else none.
 * A refused upload throws `Invalid` on `image`, like a table's; a page picture that cannot be read
 * or stored is simply none, since the member did not choose it.
 */
export async function campaignImagePath(
  storage: ImageStorage | undefined,
  {
    upload,
    pageImageUrl,
    log,
    fetcher,
    resolve,
  }: {
    upload?: File;
    pageImageUrl?: string | null;
    log?: Pick<Logger, 'warn'>;
    fetcher?: Fetcher;
    resolve?: Resolver;
  },
): Promise<string | null> {
  if (upload && upload.size > 0) {
    const prepared = await prepareImage(upload, FOLDER);
    if (!storage) throw new Invalid('image', 'upload_failed');
    return storeImage(storage, prepared, log);
  }
  if (!pageImageUrl || !storage) return null;

  const bytes = await readRemoteImage(pageImageUrl, { fetcher, resolve });
  const contentType = bytes && detectImageType(bytes);
  if (!bytes || !contentType) return null;
  const prepared: PreparedImage = {
    bytes,
    contentType,
    path: `${FOLDER}/${crypto.randomUUID()}.${TYPES[contentType]}`,
  };
  try {
    return await storeImage(storage, prepared, log);
  } catch {
    return null;
  }
}
