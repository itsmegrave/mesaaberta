// Claude Code's Stop hook (.claude/settings.json): before the agent ends a turn with uncommitted
// changes, it checks those files with Prettier and ESLint and, when code changed, the types
// (`bun run check`). A failure sends the output back to the agent once; it does not loop.
//
// It checks only what is uncommitted, so it stays fast. Tests are not run here: `bun run verify`
// is the gate before a pull request.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { bin, changedSince, modules, present, repoRoot, run } from '../verify.ts';

const input = JSON.parse(await Bun.stdin.text()) as { cwd?: string; stop_hook_active?: boolean };
// The agent is already answering this hook: let it stop, whatever the state.
if (input.stop_hook_active) process.exit(0);

const root = repoRoot(input.cwd ?? process.cwd());
// A checkout without dependencies (a fresh worktree) has nothing to check with.
if (!root || !existsSync(bin(root, 'prettier'))) process.exit(0);

const changed = changedSince(root, 'HEAD');
const files = present(root, changed);
if (files.length === 0) process.exit(0);

// The same changes that already passed are not checked again.
const state = new Bun.CryptoHasher('sha256');
for (const file of files) state.update(file).update(readFileSync(path.join(root, file)));
const fingerprint = state.digest('hex');
const stamp = path.resolve(
  root,
  run(['git', 'rev-parse', '--git-path', 'agent-stop-check'], root).out.trim(),
);
if (existsSync(stamp) && readFileSync(stamp, 'utf8') === fingerprint) process.exit(0);

const failures: string[] = [];
const check = (label: string, cmd: string[]) => {
  const result = run(cmd, root);
  if (!result.ok) failures.push(`${label} failed:\n${result.out.trim().slice(-4000)}`);
};

check('Prettier', [bin(root, 'prettier'), '--check', '--ignore-unknown', ...files]);
const code = modules(files);
if (code.length > 0) check('ESLint', [bin(root, 'eslint'), '--no-warn-ignored', ...code]);
if (modules(changed).length > 0) check('Typecheck (bun run check)', ['bun', 'run', 'check']);

if (failures.length > 0) {
  console.error(`${failures.join('\n\n')}\n\nFix these before finishing, or say why they stand.`);
  process.exit(2);
}
writeFileSync(stamp, fingerprint);
