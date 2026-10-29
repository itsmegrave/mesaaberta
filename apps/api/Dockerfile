# The api on Bun, for a self-hosted deployment. Build from the repository root:
#   docker build -f apps/api/Dockerfile -t mesaaberta-api .
# It listens on :8788 on a private network behind the web app and needs API_INTERNAL_TOKEN (the
# shared secret the web app sends in x-internal-token), DATABASE_URL and the Auth/mail settings.
# Never publish its port: over HTTP the actor header is only a claim, guarded by that secret.
FROM oven/bun:1.4-slim
WORKDIR /app

# The workspace manifests first, so the dependency layer is reused when only code changes.
COPY package.json bun.lock bunfig.toml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/mcp/package.json apps/mcp/package.json
COPY packages packages
RUN bun install --frozen-lockfile --production

COPY apps/api apps/api

USER bun
ENV PORT=8788
EXPOSE 8788
HEALTHCHECK --interval=15s --timeout=3s --retries=5 \
  CMD bun -e "fetch('http://127.0.0.1:'+(process.env.PORT||8788)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["bun", "apps/api/src/entry/bun.ts"]
