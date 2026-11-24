// Claude Code's PostToolUse hook for Edit and Write (.claude/settings.json): formats the file the
// agent just wrote with the project's Prettier, so `bun run lint` never fails on style alone.
// It never blocks: a file Prettier cannot read, or a checkout without dependencies, is left as is.
import { existsSync } from 'node:fs';
import path from 'node:path';

const input = JSON.parse(await Bun.stdin.text()) as { tool_input?: { file_path?: string } };
const file = input.tool_input?.file_path;

if (file && path.isAbsolute(file) && existsSync(file)) {
  const top = Bun.spawnSync(['git', 'rev-parse', '--show-toplevel'], { cwd: path.dirname(file) });
  const root = top.stdout.toString().trim();
  // Only files of a checkout that has Prettier installed (a fresh worktree may not, yet).
  if (top.exitCode === 0 && existsSync(path.join(root, 'node_modules/.bin/prettier')))
    Bun.spawnSync(
      [path.join(root, 'node_modules/.bin/prettier'), '--write', '--ignore-unknown', file],
      { cwd: root, stdout: 'ignore', stderr: 'ignore' },
    );
}
