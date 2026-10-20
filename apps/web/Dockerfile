# The web app on Bun, for a self-hosted deployment. Build from the repository root:
#   docker build -f apps/web/Dockerfile -t mesaaberta-web .
# It listens on PORT (default 3000) and needs DATABASE_URL plus the Auth, mail and storage settings
# the app reads (see the README). `docker compose up` wires it to the bundled Postgres.
FROM oven/bun:1.4 AS build
WORKDIR /app

# The workspace manifests first, so the dependency layer is reused when only code changes.
COPY package.json bun.lock bunfig.toml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages packages
RUN bun install --frozen-lockfile

COPY apps/web apps/web
RUN cd apps/web && HOST=bun bun run --bun vite build

# Applies the pending migrations and exits: `docker compose up` runs it before the web app starts.
FROM build AS migrate
COPY drizzle.config.ts ./
COPY drizzle drizzle
CMD ["bun", "./node_modules/drizzle-kit/bin.cjs", "migrate"]

FROM oven/bun:1.4-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/apps/web/build build
COPY --from=build /app/apps/web/package.json package.json
USER bun
EXPOSE 3000
CMD ["bun", "build/index.js"]
