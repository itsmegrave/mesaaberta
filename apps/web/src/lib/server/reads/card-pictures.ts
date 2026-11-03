import { imageUrl, pictureOf } from '@mesaaberta/core/server/images';

/**
 * A table card's pictures as URLs: the cover from its storage path, and the GM's avatar (theirs
 * uploaded, else the sign-in provider's). The GM fields are optional: an api Worker older than
 * them answers without, and the card then draws the GM's initial. `rating`: whether the card draws
 * the content rating's symbol (`contentRatingSymbolShown`); off, the card gets none.
 */
export const cardPictures =
  (supabaseUrl: string | undefined, rating = false) =>
  <
    T extends {
      imagePath: string | null;
      gmAvatarPath?: string | null;
      gmAvatarUrl?: string | null;
      contentRating?: string | null;
    },
  >({
    imagePath,
    gmAvatarPath = null,
    gmAvatarUrl = null,
    contentRating = null,
    ...table
  }: T) => ({
    ...table,
    contentRating: rating ? contentRating : null,
    imageUrl: imageUrl(supabaseUrl, imagePath),
    gmAvatar: pictureOf(supabaseUrl, { avatarPath: gmAvatarPath, avatarUrl: gmAvatarUrl }),
  });
