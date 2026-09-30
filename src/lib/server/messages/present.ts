import { imageUrl, pictureOf } from '../images';

type Pictured = { avatarUrl: string | null; avatarPath: string | null };

/** Swaps a person's stored picture fields for the URL to show (the path stays on the server). */
export function withPicture<T extends Pictured>(
  supabaseUrl: string | undefined,
  { avatarUrl, avatarPath, ...rest }: T,
) {
  return { ...rest, avatarUrl: pictureOf(supabaseUrl, { avatarUrl, avatarPath }) };
}

export const withPictures = <T extends Pictured>(supabaseUrl: string | undefined, rows: T[]) =>
  rows.map((row) => withPicture(supabaseUrl, row));

/** The inbox rows with a table's image and a person's picture as URLs. */
export function inboxWithPictures<T extends Pictured & { imagePath: string | null }>(
  supabaseUrl: string | undefined,
  rows: T[],
) {
  return rows.map(({ imagePath, ...row }) => ({
    ...withPicture(supabaseUrl, row),
    imageUrl: imageUrl(supabaseUrl, imagePath),
  }));
}
