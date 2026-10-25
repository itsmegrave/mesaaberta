/**
 * The people a local dev server can sign in as (`/dev/login?as=<key>`), so a person or an agent can
 * look at the app as a member, a GM or an admin without typing a password. They exist only in the
 * local Supabase (`bun run dev:up` creates them); production Auth has none of them, and CI fails if
 * this list reaches a production build (`scripts/check-no-dev-login.ts`).
 *
 * The ids are fixed so links and screenshots stay the same between runs. The GM is the seeded GM of
 * `scripts/seed.ts`, so they own the seeded tables.
 */
export type Persona = {
  id: string;
  email: string;
  name: string;
  /** Null for someone who has not finished the onboarding step. */
  username: string | null;
  role: 'member' | 'admin';
  /** Seeded tables (by slug) this persona has a confirmed seat at. */
  seatsAt?: string[];
};

/** Shared by every persona. Not a secret: the accounts exist only in a local stack. */
export const PERSONA_PASSWORD = 'mesa-aberta-dev-only';

export const personas = {
  member: {
    id: '00000000-0000-4000-8000-00000000d001',
    email: 'membro@dev.test',
    name: 'Membro de Testes',
    username: 'membro-de-testes',
    role: 'member',
  },
  gm: {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'mestre@dev.test',
    name: 'Mestre de Testes',
    username: 'mestre-de-testes',
    role: 'member',
  },
  player: {
    id: '00000000-0000-4000-8000-00000000d002',
    email: 'jogador@dev.test',
    name: 'Jogador de Testes',
    username: 'jogador-de-testes',
    role: 'member',
    seatsAt: ['os-sinos-de-sablewood'],
  },
  admin: {
    id: '00000000-0000-4000-8000-00000000d003',
    email: 'admin@dev.test',
    name: 'Admin de Testes',
    username: 'admin-de-testes',
    role: 'admin',
  },
  new: {
    id: '00000000-0000-4000-8000-00000000d004',
    email: 'novo@dev.test',
    name: 'Novo de Testes',
    username: null,
    role: 'member',
  },
} as const satisfies Record<string, Persona>;

export type PersonaKey = keyof typeof personas;

export const isPersonaKey = (key: string | null): key is PersonaKey =>
  key !== null && Object.hasOwn(personas, key);
