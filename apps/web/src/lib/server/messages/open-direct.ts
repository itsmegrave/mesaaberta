import { error } from '@sveltejs/kit';
import type { Actor } from '@mesaaberta/core/server/auth/policy';
import { Forbidden } from '@mesaaberta/core/server/errors';
import { writeViaApi } from '../api-write';

/**
 * The id of the direct conversation between the signed-in person and `recipientId`, made when
 * there is none, by the api Worker (its refusals are thrown as the domain errors `failFrom` knows).
 */
export async function openDirectConversation(
  locals: App.Locals,
  actor: Pick<Actor, 'id'> | null,
  recipientId: string,
): Promise<string> {
  if (!actor) throw new Forbidden();
  const written = await writeViaApi(locals, actor, '/v1/inbox/direct', { recipientId });
  if (typeof written.body.conversationId !== 'string') error(503, 'Invalid API response');
  return written.body.conversationId;
}
