import { z } from 'zod';
import { requiredImageFile } from '@mesaaberta/core/forms/files';

/**
 * The profile picture form: one image, refused in the browser when it is too big or of the wrong
 * type. The server still reads its bytes (`prepareImage`) before storing it.
 */
export const photoSchema = z.object({ photo: requiredImageFile });

/** The cover of the public profile: one image, checked the same way. */
export const bannerSchema = z.object({ banner: requiredImageFile });
