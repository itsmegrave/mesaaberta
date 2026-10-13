import { z } from 'zod';
import { requiredImageFile } from '$lib/forms/files';

/**
 * The profile picture form: one image, refused in the browser when it is too big or of the wrong
 * type. The server still reads its bytes (`prepareImage`) before storing it.
 */
export const photoSchema = z.object({ photo: requiredImageFile });
