# `@mesaaberta/privy` (placeholder)

The closed features of Mesa Aberta (the Instagram connector today, more later) live in the private
repository `itsmegrave/mesaaberta-privy`. A private build checks that repository out **into this
directory**, replacing this placeholder, and runs its `scripts/overlay.sh`, which replaces the three
files that name it: `packages/core/src/server/extensions/installed.ts`,
`apps/web/src/lib/extensions/panels.ts` and `apps/web/src/lib/extensions/origins.ts`.

This open source project builds and runs without it: the extension list is empty and the social
connector is `none`.

This directory exists so the workspace and the lockfile stay the same with or without the private
package. Its `package.json` must keep the same dependencies as the private package's, or
`bun install --frozen-lockfile` fails in a private build.
