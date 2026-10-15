# The background worker on Bun, for a self-hosted deployment. Build from the repository root:
#   docker build -f apps/worker/Dockerfile -t mesaaberta-worker .
# It has no port: an in-process scheduler sweeps the Postgres outbox (every SWEEP_INTERVAL_SECONDS,
# default 300) and runs the daily crowdfunding import from 04:00 UTC. It needs DATABASE_URL and the
# mail, Auth and Instagram settings the handlers use. Set EVENT_POLLER=true to sweep through the
# poller contract.
FROM oven/bun:1.4-slim
WORKDIR /app

# The workspace manifests first, so the dependency layer is reused when only code changes.
COPY package.json bun.lock bunfig.toml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages packages
RUN bun install --frozen-lockfile --production

COPY apps/worker apps/worker

USER bun
CMD ["bun", "apps/worker/src/entry/bun.ts"]
