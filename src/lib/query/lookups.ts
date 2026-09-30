import { z } from 'zod';
import { apiRead, ApiError } from '$lib/api/http';
export const availabilitySchema = z.object({ status: z.enum(['free', 'taken', 'invalid']) });
export async function usernameAvailability(username: string, signal: AbortSignal) {
  const result = availabilitySchema.safeParse(
    await apiRead<unknown>(`/onboarding/username?value=${encodeURIComponent(username)}`, signal),
  );
  if (!result.success) throw new ApiError(502, 'Invalid availability response');
  return result.data.status;
}
export const cepSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('found'),
    place: z.object({ neighbourhood: z.string().nullable(), city: z.string(), state: z.string() }),
  }),
  z.object({ status: z.literal('not_found') }),
]);
export async function cepLookup(value: string, signal: AbortSignal) {
  const result = cepSchema.safeParse(
    await apiRead<unknown>(`/api/location/cep?value=${value}`, signal),
  );
  if (!result.success) throw new ApiError(502, 'Invalid address response');
  return result.data;
}
