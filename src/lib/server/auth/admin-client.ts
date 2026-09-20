import { createClient } from '@supabase/supabase-js';

/**
 * The only privileged Auth operation email notifications need. Keeping this narrow prevents a
 * service-role client from spreading through application code.
 */
export type SupabaseAdmin = {
	auth: {
		admin: {
			getUserById(id: string): Promise<{
				data: { user: { email?: string | null } | null };
				error: { message: string } | null;
			}>;
		};
	};
};

/**
 * A server-only Supabase client for Auth Admin operations. The service-role key bypasses RLS, so
 * this module must only be imported from `$lib/server` code and the client deliberately exposes
 * no general database or storage API.
 */
export function createSupabaseAdmin(url: string, serviceRoleKey: string): SupabaseAdmin {
	return createClient(url, serviceRoleKey, {
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
