// Claude Code's Stop hook (.claude/settings.json): before the agent ends a turn with uncommitted
// changes, it checks the changed files with Prettier and ESLint and, when code changed, the types
// (`bun run check`). A failure sends the output back to the agent once; it does not loop.
//
// The full `bun run lint` takes minutes, so only the changed files are linted here. Unit tests are
// not run: `bun run verify` runs everything and is the gate before a pull request.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const input = JSON.parse(await Bun.stdin.text()) as { cwd?: string; stop_hook_active?: boolean };
// The agent is already answering this hook: let it stop, whatever the state.
if (input.stop_hook_active) process.exit(0);

const run = (cmd: string[], cwd: string) => {
  const done = Bun.spawnSync(cmd, { cwd, stdout: 'pipe', stderr: 'pipe' });
  return { ok: done.exitCode === 0, out: `${done.stdout.toString()}${done.stderr.toString()}` };
};

const top = run(['git', 'rev-parse', '--show-toplevel'], input.cwd ?? process.cwd());
if (!top.ok) process.exit(0);
const root = top.out.trim();
const bin = (name: string) => path.join(root, 'node_modules/.bin', name);
if (!existsSync(bin('prettier'))) process.exit(0);

const names = (cmd: string[]) => run(cmd, root).out.split('\0').filter(Boolean);
const changed = [
  ...names(['git', 'diff', '--name-only', '-z', 'HEAD']),
  ...names(['git', 'ls-files', '--others', '--exclude-standard', '-z']),
].filter((file) => existsSync(path.join(root, file)));
if (changed.length === 0) process.exit(0);

// The same changes that already passed are not checked again.
const state = new Bun.CryptoHasher('sha256');
for (const file of changed) state.update(file).update(readFileSync(path.join(root, file)));
const fingerprint = state.digest('hex');
const stamp = path.resolve(
  root,
  run(['git', 'rev-parse', '--git-path', 'agent-stop-check'], root).out.trim(),
);
if (existsSync(stamp) && readFileSync(stamp, 'utf8') === fingerprint) process.exit(0);

const code = changed.filter((file) => /\.(ts|js|svelte)$/.test(file));
const failures: string[] = [];
const check = (label: string, cmd: string[]) => {
  const result = run(cmd, root);
  if (!result.ok) failures.push(`${label} failed:\n${result.out.trim().slice(-4000)}`);
};

check('Prettier', [bin('prettier'), '--check', '--ignore-unknown', ...changed]);
if (code.length > 0) {
  check('ESLint', [bin('eslint'), '--no-warn-ignored', ...code]);
  check('Typecheck (bun run check)', ['bun', 'run', 'check']);
}

if (failures.length > 0) {
  console.error(`${failures.join('\n\n')}\n\nFix these before finishing, or say why they stand.`);
  process.exit(2);
}
writeFileSync(stamp, fingerprint);
