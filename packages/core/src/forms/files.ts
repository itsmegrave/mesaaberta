import { z } from 'zod';

/** The largest image anyone can upload. The server (`prepareImage`) enforces the same limit. */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
/** The image types the site accepts and shows. SVG and HTML can carry script, so never those. */
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

const accepted: readonly string[] = IMAGE_TYPES;

/**
 * An optional image field, for the form to refuse a file that is too big or of the wrong type
 * before it is uploaded. The type here is what the browser claims; the server still judges the
 * file by its first bytes (`prepareImage`). The empty file a file input posts when nothing was
 * picked counts as no image. Messages are codes, like the rest of the schemas.
 */
export const imageFile = z.preprocess(
  (value) => (value instanceof File && value.size === 0 ? undefined : value),
  z
    .instanceof(File, { message: 'not_an_image' })
    .refine((file) => file.size <= MAX_IMAGE_BYTES, 'too_big')
    .refine((file) => accepted.includes(file.type), 'not_an_image')
    .optional(),
);

/** The same checks, for a form whose only point is the image (the profile picture). */
export const requiredImageFile = z.preprocess(
  (value) => (value instanceof File && value.size === 0 ? undefined : value),
  z
    .instanceof(File, { message: 'empty' })
    .refine((file) => file.size <= MAX_IMAGE_BYTES, 'too_big')
    .refine((file) => accepted.includes(file.type), 'not_an_image'),
);
