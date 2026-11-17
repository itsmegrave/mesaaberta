import { z } from 'zod';
import { next } from '#lib/forms/next.js';

/** The browser's answer to a passkey challenge: the challenge's id and the credential as JSON. */
export const passkeyAnswerSchema = z.object({
  challengeId: z.string().trim().min(1).max(200),
  credential: z.string().min(2).max(64_000),
  next,
});

/** Removing one passkey from the account. */
export const passkeyRemoveSchema = z.object({ passkeyId: z.uuid() });
