import { z } from 'zod';

/** A deployment supplies values; this package never reads a process or a platform binding. */
export type ConfigEnv = Readonly<Record<string, unknown>>;

const origin = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash
    );
  }, 'Expected an HTTP(S) origin without credentials, a path, query or fragment')
  .transform((value) => new URL(value).origin);

const optionalUrl = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  }, 'Expected an HTTP(S) URL without credentials')
  .optional();

const hostname = z
  .string()
  .max(253)
  .refine(
    (value) =>
      value.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)),
    'Expected a hostname for the stable calendar namespace',
  );

/** Only these values may cross the SSR boundary. Unknown fields (including secrets) are stripped. */
export const publicConfigSchema = z.object({
  APP_ORIGIN: origin.default('http://localhost:5173'),
  CONTACT_EMAIL: z.email().default('contact@example.invalid'),
  PRIVACY_CONTROLLER_NAME: z.string().trim().min(1).default('Responsável pela instância'),
  PRIVACY_EMAIL: z.email().default('privacy@example.invalid'),
  INSTAGRAM_HANDLE: z
    .string()
    .regex(/^[a-zA-Z0-9._]{1,30}$/)
    .optional(),
  CANNY_APP_ID: z
    .string()
    .regex(/^[a-f0-9]{24}$/i)
    .optional(),
  CANNY_FEEDBACK_URL: optionalUrl,
  CANNY_CHANGELOG_URL: optionalUrl,
});

const configSchema = publicConfigSchema.extend({
  // Stable across releases and origin changes. Set before sending the first calendar invite.
  CALENDAR_UID_DOMAIN: hostname.default('localhost'),
});

export type PublicConfig = z.infer<typeof publicConfigSchema>;
export type Config = z.infer<typeof configSchema>;

/** Optional bindings are commonly empty in Wrangler/CI; let defaults apply to blank values. */
const withoutBlanks = (env: ConfigEnv) =>
  Object.fromEntries(
    Object.entries(env).map(([key, value]) => [
      key,
      typeof value === 'string' && value.trim() === '' ? undefined : value,
    ]),
  );

export function readConfig(env: ConfigEnv = {}): Config {
  const parsed = configSchema.safeParse(withoutBlanks(env));
  if (!parsed.success) {
    // Do not include raw input or provider secrets in a build/Worker error.
    const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error(`Invalid deployment configuration: ${fields.join(', ')}`);
  }
  return parsed.data;
}

/** Re-validate and project rather than spreading an env/config object into page data. */
export function publicConfig(config: Config): PublicConfig {
  return publicConfigSchema.parse(config);
}
