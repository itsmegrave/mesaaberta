import type { Extension } from '../extensions/contract';
import { instagramSocial } from '../social/instagram';
import { instagramAdminActions } from './admin-actions';
import { instagramAsset } from './asset';
import { instagramOAuth } from './oauth';

/** Instagram as an extension: its connector, account connection, hand actions and share image. */
export const instagramExtension: Extension = {
  id: 'instagram',
  social: instagramSocial,
  oauth: instagramOAuth,
  adminActions: instagramAdminActions,
  asset: instagramAsset,
};
