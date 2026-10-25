// Fails when the dev login (`/dev/login`, see apps/web/src/lib/server/dev) could reach production:
// its code or a persona in a build's output, or DEV_LOGIN in a deployment's config.
// Usage: bun run build && bun scripts/check-no-dev-login.ts. CI runs it after the production build.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PERSONA_PASSWORD, personas } from '../apps/web/src/lib/server/dev/personas.ts';

const markers = [
  '/dev/login',
  '/dev/logout',
  'dev_login_refused',
  PERSONA_PASSWORD,
  ...Object.values(personas).map((persona) => persona.email),
];

// What a build leaves for each host: Cloudflare (`.svelte-kit/cloudflare` and the server code
// Wrangler bundles from `.svelte-kit/output`) and Bun (`build`).
const outputs = [
  'apps/web/.svelte-kit/output',
  'apps/web/.svelte-kit/cloudflare',
  'apps/web/build',
];
const configs = [
  'wrangler.jsonc',
  ...readdirSync('apps').map((app) => join('apps', app, 'wrangler.jsonc')),
  ...readdirSync('.github/workflows').map((file) => join('.github/workflows', file)),
  'docker-compose.yml',
];

function* files(path: string): Generator<string> {
  if (statSync(path).isDirectory()) {
    for (const entry of readdirSync(path)) yield* files(join(path, entry));
  } else yield path;
}

const found: string[] = [];
const built = outputs.filter((dir) => existsSync(dir));
if (built.length === 0) {
  console.error('No build output to check. Run `bun run build` first.');
  process.exit(1);
}

for (const dir of built) {
  for (const file of files(dir)) {
    // Source maps hold the original source, comments included; what runs is the code next to them.
    if (!/\.(js|mjs|cjs|json|html)$/.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const marker of markers) if (text.includes(marker)) found.push(`${file}: ${marker}`);
  }
}
for (const file of configs.filter((path) => existsSync(path))) {
  if (readFileSync(file, 'utf8').includes('DEV_LOGIN')) found.push(`${file}: DEV_LOGIN`);
}

if (found.length > 0) {
  console.error('The dev login must never reach a deployment. Found:');
  for (const line of found) console.error(`  ${line}`);
  process.exit(1);
}
console.log(`No dev login in ${built.join(', ')} or the deployment config.`);
