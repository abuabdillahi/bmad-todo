# syntax=docker/dockerfile:1

# Build context: the repository root.

FROM node:26.13.1-bookworm-slim AS deps
RUN npm i -g pnpm@12.23.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contract/package.json packages/contract/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY e2e/package.json e2e/
RUN pnpm install --frozen-lockfile --prod --filter @todo/api...

FROM node:26.13.1-bookworm-slim AS runtime
# Links the GHCR package to the repo, so the workflow's GITHUB_TOKEN can push and pull it.
LABEL org.opencontainers.image.source=https://github.com/abuabdillahi/bmad-todo
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app /app
COPY packages/contract/src packages/contract/src
COPY apps/api/src apps/api/src
COPY apps/api/drizzle apps/api/drizzle
# The data volume mounts here; a fresh named volume takes this ownership.
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --start-interval=1s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "apps/api/src/server.ts"]
