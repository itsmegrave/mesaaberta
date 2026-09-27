import { createClient } from '@supabase/supabase-js';

/**
 * The only privileged Auth operations the app needs: reading an address for a notification, and
 * deleting the user when they close their account. Keeping this narrow prevents a privileged
 * client from spreading through application code.
 */
export type SupabaseAdmin = {
	auth: {
		admin: {
			getUserById(id: string): Promise<{
				data: { user: { email?: string | null } | null };
				error: { message: string } | null;
			}>;
			deleteUser(id: string): Promise<{ error: { message: string } | null }>;
		};
	};
};

type AdminEnv = {
	SUPABASE_URL?: string;
	SUPABASE_SECRET_KEY?: string;
	/** The legacy name of the secret key. */
	SUPABASE_SERVICE_ROLE_KEY?: string;
};

/** The admin client, or null when the secrets are not configured (local development). */
export function supabaseAdminFrom(env: AdminEnv | undefined): SupabaseAdmin | null {
	const secretKey = env?.SUPABASE_SECRET_KEY || env?.SUPABASE_SERVICE_ROLE_KEY;
	if (!env?.SUPABASE_URL || !secretKey) return null;
	return createSupabaseAdmin(env.SUPABASE_URL, secretKey);
}

/**
 * A server-only Supabase client for Auth Admin operations. `secretKey` is a Supabase secret key
 * (`sb_secret_...`; the legacy `service_role` key also works). It bypasses RLS, so this module must
 * only be imported from `$lib/server` code and the client deliberately exposes no general database
 * or storage API.
 */
export function createSupabaseAdmin(url: string, secretKey: string): SupabaseAdmin {
	return createClient(url, secretKey, {
		auth: {
			autoRefreshToken: false,
			persistSession: false,
			detectSessionInUrl: false
		}
	});
}

/** Fetches just the address needed to deliver a notification; never log its return value. */
export async function emailOf(admin: SupabaseAdmin, userId: string): Promise<string> {
	const { data, error } = await admin.auth.admin.getUserById(userId);
	if (error) throw new Error(`Supabase Admin request failed: ${error.message}`);
	if (typeof data.user?.email !== 'string' || !data.user.email) {
		throw new Error('Supabase user has no email address');
	}
	return data.user.email;
}

/** Deletes the Auth user, their email and sign-in methods with it. */
export async function deleteAuthUser(admin: SupabaseAdmin, userId: string): Promise<void> {
	const { error } = await admin.auth.admin.deleteUser(userId);
	if (error) throw new Error(`Supabase Admin request failed: ${error.message}`);
}
