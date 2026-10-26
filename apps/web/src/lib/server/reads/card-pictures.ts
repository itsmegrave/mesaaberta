import { imageUrl, pictureOf } from '@mesaaberta/core/server/images';

/**
 * A table card's pictures as URLs: the cover from its storage path, and the GM's avatar (theirs
 * uploaded, else the sign-in provider's). The GM fields are optional: an api Worker older than
 * them answers without, and the card then draws the GM's initial.
 */
export const cardPictures =
  (supabaseUrl: string | undefined) =>
  <
    T extends {
      imagePath: string | null;
      gmAvatarPath?: string | null;
      gmAvatarUrl?: string | null;
    },
  >({
    imagePath,
    gmAvatarPath = null,
    gmAvatarUrl = null,
    ...table
  }: T) => ({
    ...table,
    imageUrl: imageUrl(supabaseUrl, imagePath),
    gmAvatar: pictureOf(supabaseUrl, { avatarPath: gmAvatarPath, avatarUrl: gmAvatarUrl }),
  });
