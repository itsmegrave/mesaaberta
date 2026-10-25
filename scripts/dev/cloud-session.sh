#!/usr/bin/env bash
# Claude Code's SessionStart hook (.claude/settings.json). In a cloud session it gets the local stack
# ready for the dev login in the background: Docker, the local Supabase, the personas, `.dev.vars`.
# On anyone's own machine it does nothing.
set -u
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0

log=/tmp/mesaaberta-dev-up.log
(
  bunx bun@1.4.2 install --frozen-lockfile
  # dev:up starts dockerd when it is not running. The image registries rate-limit now and then; one more try usually gets through.
  bun run dev:up || bun run dev:up
  echo "dev-up finished with exit code $?"
) >"$log" 2>&1 &

echo "The local Supabase and the dev personas are starting in the background (log: $log, about 3 minutes; done when it prints 'dev-up finished')."
echo "Then: bun run dev:local, and sign in with http://localhost:5173/dev/login?as=member|gm|player|admin|new&next=/path"
