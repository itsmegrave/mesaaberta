@AGENTS.md

## Claude Code

- The rules above are in `AGENTS.md`, shared with every coding agent. Edit them there, not here.
- `.graveflow.json` configures the [graveflow](https://github.com/itsmegrave/graveflow) plugin's hooks for this repository: each file you write is formatted with Prettier; a turn that ends with uncommitted changes is checked with Prettier, ESLint and the typecheck; `wrangler deploy` without `--dry-run` is refused. Without the plugin installed nothing runs, and `bun run verify` is still the gate.
- For large work, use the plugin's `spec-workflow` skill.
