import type { Extension } from '@mesaaberta/core/server/extensions/contract';
import { instagramSocial } from './social';
import { instagramAdminActions } from './admin-actions';
import { instagramAdmin } from './admin';
import { instagramAsset } from './asset';
import { instagramOAuth } from './oauth';
import { instagramFlags } from './flags';

/** Instagram as an extension: its connector, account connection, hand actions and share image. */
export const instagramExtension: Extension = {
  id: 'instagram',
  flags: instagramFlags,
  social: instagramSocial,
  admin: instagramAdmin,
  oauth: instagramOAuth,
  adminActions: instagramAdminActions,
  asset: instagramAsset,
};
