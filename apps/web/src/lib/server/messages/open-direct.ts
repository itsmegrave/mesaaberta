import type { Actor } from '@mesaaberta/core/server/auth/policy';
import { openDirect } from '@mesaaberta/core/server/messages/service';
import { writeViaApi } from '../api-write';

/**
 * The id of the direct conversation between the signed-in person and `recipientId`, made when
 * there is none. Through the api Worker when `api_inbox` is on for them (its refusals are thrown as
 * the domain errors `failFrom` knows); in this Worker otherwise, or when the call cannot be made.
 */
export async function openDirectConversation(
  locals: App.Locals,
  actor: Actor | null,
  recipientId: string,
): Promise<string> {
  const remote = actor
    ? await writeViaApi(locals, 'api_inbox', actor, '/v1/inbox/direct', { recipientId })
    : null;
  if (typeof remote?.body.conversationId === 'string') return remote.body.conversationId;
  return (await openDirect(locals.db!, actor, recipientId)).id;
}
