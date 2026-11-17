import { sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';

// Whether the account can sign in with its e-mail and a password. Supabase Auth adds no `email`
// identity when a password is set on an account that signed up with a provider (through "Criar uma
// senha" or the reset link), so the identities cannot tell: only `auth.users` knows. One boolean
// leaves this module, never the hash.

/** True when the Auth user `id` has a password. */
export async function hasPassword(db: AnyDb, id: string): Promise<boolean> {
  const result: unknown = await db.execute(sql`
    select coalesce(encrypted_password, '') <> '' as has_password from auth.users where id = ${id}
  `);
  // postgres.js answers with the rows, PGlite with `{ rows }`.
  type Row = { has_password: boolean };
  const rows = (Array.isArray(result) ? result : (result as { rows: Row[] }).rows) as Row[];
  return rows[0]?.has_password === true;
}
