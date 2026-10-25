// Gets a local dev server ready to sign in as a persona (`/dev/login?as=gm`): starts the local
// Supabase if it is not running, creates the personas in its Auth, and points `.dev.vars` at it.
// Usage: bun run dev:up, then bun run dev:local. Safe to run again. It refuses a non-local stack.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { stack, type Stack } from '../../apps/web/e2e/support/stack.ts';
import {
  PERSONA_PASSWORD,
  personas,
  type Persona,
} from '../../apps/web/src/lib/server/dev/personas.ts';
import { DEV_API_PORT, DEV_API_TOKEN } from './local.ts';

const running = (): Stack | null => {
  try {
    return stack();
  } catch {
    return null;
  }
};

if (!running()) execFileSync('bun', ['run', 'e2e:up'], { stdio: 'inherit' });
const local = stack();

for (const url of [local.API_URL, local.DB_URL]) {
  const { hostname } = new URL(url);
  if (hostname !== '127.0.0.1' && hostname !== 'localhost')
    throw new Error(`Refusing to create the dev personas on ${hostname}: only a local stack.`);
}

const auth = createClient(local.API_URL, local.SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
}).auth.admin;
const sql = postgres(local.DB_URL, { max: 1, onnotice: () => {} });

try {
  for (const persona of Object.values(personas) as Persona[]) {
    const created = await auth.createUser({
      id: persona.id,
      email: persona.email,
      password: PERSONA_PASSWORD,
      email_confirm: true,
      user_metadata: { name: persona.name },
    });
    if (created.error) {
      // Already there from an earlier run: make sure the password still matches.
      const updated = await auth.updateUserById(persona.id, {
        email: persona.email,
        password: PERSONA_PASSWORD,
        email_confirm: true,
      });
      if (updated.error)
        throw new Error(`could not create ${persona.email}: ${created.error.message}`);
    }

    await sql`
      insert into profiles (id, username, name, role)
      values (${persona.id}, ${persona.username}, ${persona.name}, ${persona.role})
      on conflict (id) do update
        set username = excluded.username, name = excluded.name, role = excluded.role, status = 'active'`;

    for (const slug of persona.seatsAt ?? []) {
      await sql`
        insert into registrations (table_id, player_id, status)
        select id, ${persona.id}, 'confirmed' from game_tables where slug = ${slug}
        on conflict do nothing`;
    }
  }
} finally {
  await sql.end();
}

// Only the keys this needs; everything else in .dev.vars stays as it was.
const vars: Record<string, string> = {
  DATABASE_URL: local.DB_URL,
  SUPABASE_URL: local.API_URL,
  SUPABASE_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: local.SECRET_KEY,
  MAILPIT_URL: local.MAILPIT_URL,
  API_URL: `http://127.0.0.1:${DEV_API_PORT}`,
  API_INTERNAL_TOKEN: DEV_API_TOKEN,
  DEV_LOGIN: 'true',
};
const lines = existsSync('.dev.vars') ? readFileSync('.dev.vars', 'utf8').split('\n') : [];
const kept = lines.filter((line) => !Object.keys(vars).includes(line.split('=')[0].trim()));
while (kept.at(-1) === '') kept.pop();
writeFileSync(
  '.dev.vars',
  [...kept, ...Object.entries(vars).map(([key, value]) => `${key}=${value}`), ''].join('\n'),
);

console.log(`
The personas are ready: ${Object.keys(personas).join(', ')}.
Start the app with \`bun run dev:local\`, then open
  http://localhost:5173/dev/login?as=gm&next=/t/os-sinos-de-sablewood/manage
Run \`bun run e2e:up\` again before the e2e suite: it resets the seeded tables' seats.`);
