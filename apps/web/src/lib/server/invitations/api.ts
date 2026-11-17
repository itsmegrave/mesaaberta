import type { Actor } from '@mesaaberta/core/server/auth/policy';
import { Forbidden } from '@mesaaberta/core/server/errors';
import type {
  invitationPreferences as preferences,
  listReceivedInvitations as received,
  listTableInvitations as sent,
  loadInvitation as detail,
  pendingInvitationFor as pending,
} from '@mesaaberta/core/server/invitations/service';
import { requireApi } from '../api-required';

/** JSON dates are restored at this server adapter, preserving the existing page DTO contract. */
function dates<T>(value: T): T {
  if (Array.isArray(value)) return value.map(dates) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        ['expiresAt', 'createdAt', 'respondedAt', 'startsAt'].includes(key) &&
        typeof item === 'string'
          ? new Date(item)
          : dates(item),
      ]),
    ) as T;
  }
  return value;
}
async function read<T>(locals: App.Locals, actor: Actor | null, path: string): Promise<T> {
  if (!actor) throw new Forbidden();
  return dates(await requireApi<T>(locals, actor, path));
}
export const invitationPreferences = (locals: App.Locals, actor: Actor | null) =>
  read<Awaited<ReturnType<typeof preferences>>>(
    locals,
    actor,
    '/v1/account/invitation-preferences',
  );
export const listReceivedInvitations = (locals: App.Locals, actor: Actor | null) =>
  read<Awaited<ReturnType<typeof received>>>(locals, actor, '/v1/account/invitations');
export const listTableInvitations = (locals: App.Locals, actor: Actor | null, slug: string) =>
  read<Awaited<ReturnType<typeof sent>>>(
    locals,
    actor,
    `/v1/tables/${encodeURIComponent(slug)}/invitations`,
  );
export const loadInvitation = (locals: App.Locals, actor: Actor | null, id: string) =>
  read<Awaited<ReturnType<typeof detail>>>(
    locals,
    actor,
    `/v1/invitations/${encodeURIComponent(id)}`,
  );
export const pendingInvitationFor = (locals: App.Locals, actor: Actor | null, slug: string) =>
  read<Awaited<ReturnType<typeof pending>>>(
    locals,
    actor,
    `/v1/tables/${encodeURIComponent(slug)}/my-invitation`,
  );
