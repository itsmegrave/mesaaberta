import { z } from 'zod';
export const invitationFormSchema = z.object({
  username: z.string().trim().max(64).default(''),
  invitationId: z.string().default(''),
  gmId: z.string().default(''),
  enabled: z.enum(['true', 'false']).default('true'),
  blocked: z.enum(['true', 'false']).default('true'),
});
export type InvitationFormValues = z.infer<typeof invitationFormSchema>;
