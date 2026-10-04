import type { SupabaseClient, UserIdentity } from '@supabase/supabase-js';
import type { Provider } from '$lib/auth/providers';
import { providers } from '$lib/auth/providers';
import { Forbidden, Invalid, NotFound } from '../errors';
import { safeNext } from './safe-next';

// The ways a person can sign in to their account: the OAuth providers linked to the same Auth user
// (Supabase "manual identity linking") and their email and password. Everything here acts on the
// signed-in user's own session. `auth.identities` is never read directly, and only the provider's
// name leaves this module: no email, `provider_id`, `identity_id` or any other Auth metadata.

/** Where the person lands after connecting, with the sentence that says it worked. */
const CONNECTED = '/account/profile?conta=conectada';

export type Connection = { provider: Provider; connected: boolean };

export type Connections = {
  /** Each provider the app offers, connected or not. */
  providers: Connection[];
  /** Whether the account also signs in with an email and a password. */
  email: boolean;
  /** How many ways to sign in the account has. A person can never be left with none. */
  total: number;
};

async function identitiesOf(supabase: SupabaseClient): Promise<UserIdentity[]> {
  const { data, error } = await supabase.auth.getUserIdentities();
  if (error) throw new Error(`could not list the identities: ${error.message}`);
  return data?.identities ?? [];
}

/** What the account is connected to. Reads only the provider names. */
export async function connections(supabase: SupabaseClient): Promise<Connections> {
  const linked = new Set((await identitiesOf(supabase)).map((identity) => identity.provider));

  return {
    providers: providers.map((provider) => ({ provider, connected: linked.has(provider) })),
    email: linked.has('email'),
    total: linked.size,
  };
}

/**
 * Where to send the person to connect another provider, or null if Supabase gave no URL. They come
 * back to the callback and then to the profile page.
 */
export async function startLink(
  supabase: SupabaseClient,
  { provider, origin, next }: { provider: Provider; origin: string; next?: string | null },
): Promise<string | null> {
  const target = safeNext(next, CONNECTED);
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(target)}`;

  const { data } = await supabase.auth.linkIdentity({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });

  return data?.url ?? null;
}

/**
 * Disconnects a provider from the account, never the last way to sign in. Throws `NotFound` for a
 * provider that is not connected, `Forbidden` when it is the only one left, and `Invalid` when
 * Supabase refuses for another reason.
 */
export async function unlink(supabase: SupabaseClient, provider: Provider): Promise<void> {
  const identities = await identitiesOf(supabase);

  const identity = identities.find((candidate) => candidate.provider === provider);
  if (!identity) throw new NotFound(`not connected to ${provider}`);
  if (identities.length < 2) throw new Forbidden('the last way to sign in cannot be removed');

  const { error } = await supabase.auth.unlinkIdentity(identity);
  if (error) throw new Invalid('provider', 'unlink_failed');
}
