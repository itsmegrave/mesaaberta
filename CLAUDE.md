@AGENTS.md

## Claude Code

- The rules above are in `AGENTS.md`, shared with every coding agent. Edit them there, not here.
- Hooks (`.claude/settings.json`, scripts in `scripts/agent/`): each file you write is formatted with Prettier; a turn that ends with uncommitted changes is checked with Prettier, ESLint and the typecheck; `wrangler deploy` without `--dry-run` and a force-push to `main` are refused.
- For large work, use the `spec-workflow` skill when it is installed.
