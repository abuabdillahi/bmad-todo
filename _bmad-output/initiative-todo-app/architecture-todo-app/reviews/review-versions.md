---
review: versions-and-fit
target: architecture-todo-app.md (Stack table, AD-5, AD-17, Deferred) + .memlog.md (version) entries
reviewed: 2026-11-23
method: live npm registry (registry.npmjs.org full docs incl. peerDependencies/engines/time/scripts), package tarballs, nodejs.org/dist/index.json + nodejs/Release schedule.json, Docker Hub v2 tags API, MCR tags list, GitHub REST (releases, issues, advisories), nginx.org, pnpm.io, typescriptlang.org
verdict: PASS WITH CORRECTIONS (2 material, 6 minor)
---

# Version and fit review: Todo App v1 spine

## Verdict

**Pass with corrections.** Every npm version in the Stack table exists, is the current `latest` dist-tag, and isn't deprecated. Every pin is past the patched version in the GitHub advisories for fastify, drizzle-orm, vite and ajv. The memlog's 2026-11-23 verification of existence holds up. Checking fit turned up two material problems that the existence check missed:

1. **`nginxinc/nginx-unprivileged` is a frozen, unmaintained registry.** The image moved to `nginx/nginx-unprivileged`. The pinned `nginxinc/...:1.31-alpine` is nginx **1.31.7** (pushed 2026-10-19). It lacks the 2026-11-18 fixes for 10 CVEs (including HTTP/2 memory corruption and "buffer overflow when using alias with try_files") and the 2026-11-23 fix.
2. **`openapi-typescript` / `openapi-fetch` are in maintenance mode, and `openapi-typescript` 7.13.0 declares `peerDependencies: { typescript: "^5.x" }`**, which conflicts with the TypeScript 6.0.3 pin. No release has shipped since 2026-02-11.

## Confirmed (no change needed)

| Item | Live evidence |
| --- | --- |
| Node 26.13.1 is Active LTS | nodejs.org/dist/index.json: v26.13.1, 2026-11-10, `lts: "Lithium"`, security release, `modules: 147`. schedule.json: v26 LTS 2026-10-28, maintenance 2027-10-20, EOL 2029-04-30. v24 entered maintenance 2026-10-20. Docker tags `node:26.13.1-alpine` (= alpine3.24), `node:26-alpine`, `26-trixie-slim` exist for amd64 and arm64 |
| Latest versions | npm `latest` = pinned for fastify 5.12.8, @fastify/swagger 9.9.5, @fastify/type-provider-typebox 6.3.0, typebox 1.4.7, better-sqlite3 13.2.0, drizzle-orm 0.45.4, drizzle-kit 0.31.11, react 19.3.1, vite 8.3.8, @vitejs/plugin-react 6.3.0, @tanstack/react-query 5.108.4, openapi-typescript 7.13.0, openapi-fetch 0.17.0, vitest 5.1.1, @vitest/coverage-v8 5.1.1, @testing-library/react 16.3.3, msw 3.0.7, ajv 8.20.0, @playwright/test 1.65.1, @axe-core/playwright 4.14.0, pnpm 12.23.0. None are deprecated |
| TypeScript 6.0.3 instead of 7.0.2 | typescript-eslint 8.74.0 (published 2026-11-23) peer `typescript: ">=4.8.4 <6.1.0"`, eslint `^8.57 \|\| ^9 \|\| ^10` (eslint latest 10.15.0). 6.0.3 is the newest 6.x. Pin is correct. openapi-typescript (below) is a second blocker for TS 7 |
| @fastify/swagger 9.9.5 + fastify 5.12 | No peers. Plugin metadata `fastify: '5.x'` (index.js). Dep `fastify-plugin ^6` |
| @fastify/swagger emits OpenAPI 3.1 | 9.9.5 README: "The OpenAPI version of the generated document is taken from the `openapi.openapi` string (`3.0.3` by default). Set it to `3.1.0` or `3.2.0`…". In 3.1 documents, schemas with `type: 'null'` are left as-is. **The default is 3.0.3, so `openapi: { openapi: '3.1.0' }` must be set explicitly** |
| @fastify/type-provider-typebox 6.3.0 + fastify 5.12 + typebox 1.x | peer `typebox: ^1.1.14` (1.4.7 OK) **and `ajv-formats: ^3.0.1`** (see minor correction). Package devDeps test against `fastify ^5.0.0`, `typescript ~6.0.2`, `@types/node ^26` |
| typebox 1.4.7 schema output | Its kind metadata is non-enumerable by default (`system/memory/create.mjs`, `WithHidden` unless `enumerableKind` is set), so it doesn't leak into `openapi.json` |
| @vitejs/plugin-react 6.3.0 + vite 8 | peer `vite: ^8.0.0`. engines `^20.19.0 \|\| >=22.12.0` |
| vitest 5.1.1 + vite 8 + Node 26 | peer `vite: ^6.4.0 \|\| ^7.0.0 \|\| ^8.0.0` (non-optional). engines `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0` |
| @vitest/coverage-v8 matches vitest | coverage-v8 5.1.1 peer `vitest: 5.1.1` (exact). vitest peer `@vitest/coverage-v8: 5.1.1` |
| @testing-library/react 16.3.3 + React 19.3 | peer `react`/`react-dom` `^18 \|\| ^19`. **Also `@testing-library/dom: ^10.0.0` (required)** |
| TanStack Query 5.108.4 + React 19.3 | peer `react: ^18 \|\| ^19`. No v6 published. Note: published 2026-11-23 13:20 UTC (see pnpm minimumReleaseAge note) |
| openapi-fetch 0.17 + openapi-typescript 7.13 | Released together on 2026-02-11 from the same monorepo. openapi-fetch depends on `openapi-typescript-helpers ^0.1.0` |
| drizzle-orm 0.45.4 + better-sqlite3 13 | peer `better-sqlite3: >=7` (optional). 0.45.4 is past the SQL-identifier-injection advisory (patched in 0.45.2). drizzle-kit 0.31.11 has no peers |
| @axe-core/playwright 4.14.0 + @playwright/test 1.65.1 | peer `playwright-core: >= 1.0.0` (playwright-core 1.65.1 comes in via @playwright/test). dep `axe-core ~4.14.0` (resolves to 4.14.1, published 2026-11-16). engines `>=22.12.0` |
| msw 3.0.7 + Node 26 | engines `node >=22.12.0`. Optional peer `typescript >=5.9.x` (6.0.3 OK). No install script |
| better-sqlite3 13 on Node 26 (alpine musl and glibc, arm64 and x64) | **No build toolchain needed.** v13.0.0 release notes: "first version … to run on the N-API … prebuilt binaries are published directly with the `better-sqlite3` code". The 13.2.0 tarball contains `prebuilds/{linux,linuxmusl}-{x64,arm64}.node` (plus darwin/win32), built with `NAPI_VERSION=10` (binding.gyp), so they don't depend on ABI 147. It has no install script and `gypfile: false`, so pnpm's build-script approval doesn't apply. 13.2.0 also fixed musl detection (reads `/proc/self/maps`). engines `>=22`. A Dockerfile build stage doesn't need `python3 make g++` |
| cloudflare/cloudflared:2026.11.2 | Exists (Hub, amd64 and arm64, pushed 2026-11-23). Equals `latest`. GitHub release 2026.11.2 dated 2026-11-23 |
| Playwright CI image | `mcr.microsoft.com/playwright:v1.65.1-noble` exists if CI runs e2e in a container |
| Rejection of node:sqlite | Node v26 docs: `node:sqlite` "Stability: 1.2 - Release candidate". Memlog claim confirmed |
| Ajv 8.20.0 | Past the `$data` ReDoS fix (8.18.0) |

## Material corrections

### M1. `nginxinc/nginx-unprivileged:1.31-alpine` → `nginx/nginx-unprivileged:1.30-alpine` (or `:1.31-alpine` in the new namespace)

- **Evidence:** Docker Hub `nginxinc/nginx-unprivileged` description reads "This registry is no longer maintained, please use https://hub.docker.com/r/nginx/nginx-unprivileged/ instead." Every tag there was last updated 2026-10-19. `nginxinc/...:1.31-alpine` = `1.31.7-alpine` (digest b5047b9b7684).
- The repo moved to `github.com/nginx/docker-nginx-unprivileged`. Its README says "Docker Hub – https://hub.docker.com/r/nginx/nginx-unprivileged. **Note:** For releases prior to NGINX 1.31.7 (mainline) and 1.30.6 (stable), use the old registry link". Its commits "Updated mainline to 1.31.9 and stable to 1.30.7" (2026-11-18) and "Updated mainline to 1.31.10 and stable to 1.30.8" (2026-11-23) were published only to the new namespace.
- In the new namespace, `nginx/nginx-unprivileged:1.31-alpine` = 1.31.10 and `:1.30-alpine` = `:stable-alpine` = 1.30.8. Both were pushed 2026-11-23 for amd64 and arm64.
- **Security impact:** nginx.org news for 2026-11-18 (1.30.7 / 1.31.9) lists fixes for 10 CVEs, including HTTP/2 flow-control memory corruption, HTTP/2 and HTTP/3 use-after-free, and "buffer overflow when using alias with try_files". 2026-11-23 (1.30.8 / 1.31.10) fixes CVE-2026-132779. The pinned image has none of these.
- **Stable vs mainline:** `1.31` is **mainline** (its digest equals `mainline-alpine`). Stable is `1.30` (1.30.8). nginx.org recommends mainline, so either is defensible, but the spine should say which branch it chose. Recommendation: `nginx/nginx-unprivileged:1.30-alpine` (stable). With only static files and a proxy, the web tier needs no mainline-only features.
- The memlog `(version)` line and the Stack table both need the new namespace.
- Open issue nginx/docker-nginx-unprivileged#434 asks for an official statement on the namespace move, so supply-chain-wary teams may want to pin by digest. The move is documented in the project's own README, linked from the old Hub page.

### M2. openapi-typescript 7.13.0 / openapi-fetch 0.17.0: record maintenance mode and the TS 6 peer conflict

- **Evidence:** openapi-typescript 7.13.0 has `peerDependencies: { "typescript": "^5.x" }` (also 7.10.0 and 7.12.0). No newer version exists, and no 8.x. The last release of either package was 2026-02-11.
- The creator (drwpow) posted openapi-ts/openapi-typescript#2874 (2026-09-19): "**openapi-typescript is in maintenance mode and won't be getting any more updates.** Please migrate to another project." The post says this includes security patches. The repo isn't archived, but the last commits (2026-09-25) are Renovate bumps only.
- PRs adding TS 6 support (#2774, #2818) and TS 6/7 support (#2872) are open and won't be merged. #2723 notes that `openapi-typescript-helpers` 0.1.0 `Readable<T>`/`Writable<T>` break `Date` fields under TS 6. **This doesn't affect this contract**: `createdAt` is a `string`, and there are no `format: date-time` → `Date` transforms.
- **Practical effect today:** pnpm `strictPeerDependencies` defaults to `false` (pnpm.io/settings/peer-dependencies), so install warns but doesn't fail. Upstream PRs report the generator passes with TS 6 with no code changes.
- **What to change in the spine (pick one and record it):**
  - (a) **Keep openapi-typescript 7.13.0 + openapi-fetch 0.17.0 as a frozen dependency.** Add `peerDependencyRules.allowedVersions: { "openapi-typescript>typescript": "6" }` to `pnpm-workspace.yaml`. Record in the spine/memlog that both are unmaintained (as of 2026-09-19) and block TS 7. The tools are small, handwritten and only touch codegen and types (openapi-fetch is a thin runtime wrapper), so the risk is acceptable for v1. Revisit with the TS 7 deferral.
  - (b) **Swap to a maintained generator.** `@hey-api/openapi-ts` 0.99.0 (peer `typescript >=5.5.3 || >=6.0.0`, about 8.3M weekly downloads, still 0.x, last stable 2026-06-22, bundles its own fetch client) or `orval` 8.49.0 (published 2026-11-22, about 4.3M weekly). Either changes AD-5's "consumed by openapi-fetch" wording and the web API-client layer.
  - Not recommended: the `openapi-typesafe` fork (1.0.0-rc.16, created 2026-11-02, one maintainer, about 4.9K weekly). It would invert the original maintainer's stated supply-chain concern.
- Reviewer's recommendation: (a) for v1, plus a Deferred entry naming the replacement trigger (TS 7 adoption or any advisory against either package).

## Minor corrections and additions

| # | Item | Correction | Source |
| --- | --- | --- | --- |
| m1 | `ajv-formats` (missing) | Pin `ajv-formats@3.0.1` in `apps/api`. It is a **required** peer of `@fastify/type-provider-typebox` 6.3.0 (`ajv-formats: ^3.0.1`). The contract suite also needs it to validate `format: uuid`. ajv-formats 3.0.1 peer `ajv ^8` | npm registry |
| m2 | `@testing-library/dom` (missing) | Pin `@testing-library/dom@10.4.2` in `apps/web` devDeps. It is a **required** peer of @testing-library/react 16.3.3 (`^10.0.0`). Also pin a DOM env for Vitest, e.g. `jsdom@31.0.1` (engines `>=26.0.0` OK) | npm registry |
| m3 | Ajv usage for the contract suite | `openapi.json` is OpenAPI 3.1, which means JSON Schema 2020-12. Use `Ajv2020` (`ajv/dist/2020`) + ajv-formats, not the default draft-07 `Ajv`. Worth one line in the AD-5 or Tests convention | OpenAPI 3.1 / Ajv 8 docs; @fastify/swagger README |
| m4 | AD-17 HEALTHCHECK wording vs `cloudflared` | The cloudflared image is distroless (`FROM gcr.io/distroless/base-debian13:nonroot`, no shell, no `wget`/`node`), so "uses only tools already in that image (`node` or `wget`)" can't apply to it. Use `cloudflared tunnel --metrics 127.0.0.1:2000 ready` (the built-in `ready` subcommand, merged in cloudflared#1135). Run cloudflared with `--metrics 127.0.0.1:2000` (or `TUNNEL_METRICS`) so the port is known. Otherwise, scope AD-17's tool rule to the `api`/`web` images built from this repo. `node:26-alpine` and `nginx-unprivileged` alpine both ship busybox `wget`, so the rule holds for those two | cloudflare/cloudflared Dockerfile; cmd/cloudflared/tunnel/subcommands.go (`Name: "ready"`); cloudflared#1746 |
| m5 | pnpm in Docker and CI on Node 26 | Corepack **is not distributed with Node ≥25** (nodejs/node `doc/contributing/distribution.md`: "It is no longer distributed as of Node.js 25.0.0". The v26 `corepack.html` doc returns 404. The docker-node 26/alpine3.24 Dockerfile installs only npm). So `corepack enable` won't work in `node:26.13.1-alpine`. Install pnpm 12.23.0 explicitly: `npm i -g pnpm@12.23.0` in the build stage, `pnpm/action-setup` in Actions, plus `packageManager: "pnpm@12.23.0"` in root `package.json` | nodejs/node docs; docker-node Dockerfile |
| m6 | pnpm 12 defaults that will bite on first install | (i) `strictDepBuilds` defaults to **true**: install exits non-zero on unreviewed build scripts. `esbuild` (via drizzle-kit 0.31.11 → `esbuild ^0.25.4` and `tsx`) has `postinstall: node install.js`, so add `allowBuilds: { esbuild: true }` (or `false`, since esbuild works from its optional platform packages) to `pnpm-workspace.yaml`. (ii) `minimumReleaseAge` defaults to **1440 min**. @tanstack/react-query 5.108.4, typescript-eslint 8.74.0 (both published 2026-11-23) and cloudflared 2026.11.2 are same-day releases. Exact pins still install (non-strict fallback), but if the team sets `minimumReleaseAge` explicitly, strict mode turns on and those pins fail until 24h have passed. Either accept that or pin the previous patch | pnpm.io/settings/build, /settings/dependency-resolution |

## Fit notes (not version changes, but likely to trip the first story)

- **TypeScript 6 default changes:** `types` now defaults to `[]`, so `@types/node` and Vitest globals must be listed explicitly. `strict` is now true by default. `moduleResolution node`/`node10`, `baseUrl` and `esModuleInterop: false` are deprecated. Use `module: nodenext` for `apps/api` and `module: preserve` + `moduleResolution: bundler` for `apps/web`. (typescriptlang.org TS 6.0 release notes.)
- **`@types/better-sqlite3`:** better-sqlite3 13.2.0 ships no `.d.ts`. Use `@types/better-sqlite3@9.6.0` (tagged for ts6.0). It predates v13's new `db.explain()`/`toString()`, which v1 doesn't need.
- **TypeScript 7 deferral:** besides typescript-eslint, openapi-typescript (M2) also blocks TS 7, because it uses the TS JS compiler API. Name both in the Deferred entry.
- **Version-pin housekeeping:** the memlog line `typescript 7.0.2` in the "verified" list is the *latest*, not the pin. The next line explains it, but the Stack table (6.0.3) is the authority.

## Watch items (no action for v1)

- **drizzle 1.0:** `drizzle-orm`/`drizzle-kit` 1.0.0-rc.6 published 2026-11-20 (`latest` is still 0.45.4 / 0.31.11). 1.0 changes the drizzle-kit migration folder layout, so expect a one-time `drizzle-kit up` when adopting it. Staying on 0.45/0.31 is right until 1.0 is `latest`. drizzle-kit 0.31.11 pulls the deprecated `@esbuild-kit/esm-loader` ("Merged into tsx"), which causes an install warning only.
- **Fastify 6:** `6.0.0-alpha.6` exists under `next`. @fastify/swagger and type-provider-typebox are 5.x-scoped.
- **nginx-unprivileged open issues:** #435 (permissions on default `50x.html`/`index.html`) and #432 (rebuild with patched Alpine packages) are relevant if the web image relies on the defaults.

## Sources (all fetched 2026-11-23)

- `https://registry.npmjs.org/<pkg>` (full packuments; peerDependencies, engines, scripts, time, dist-tags) for every package above; tarballs for better-sqlite3 13.2.0, @fastify/swagger 9.9.5, @fastify/type-provider-typebox 6.3.0, typebox 1.4.7
- `https://nodejs.org/dist/index.json`; `https://raw.githubusercontent.com/nodejs/Release/main/schedule.json`; `https://nodejs.org/docs/latest-v26.x/api/sqlite.html`; nodejs/node `doc/contributing/distribution.md`; nodejs/docker-node `26/alpine3.24/Dockerfile`
- `https://api.github.com/repos/WiseLibs/better-sqlite3/releases/tags/v13.0.0`, `…/v13.2.0`
- `https://hub.docker.com/v2/repositories/{nginxinc,nginx}/nginx-unprivileged/tags`, `library/nginx`, `library/node`, `cloudflare/cloudflared`; `https://mcr.microsoft.com/v2/playwright/tags/list`
- `https://nginx.org/` (news), nginx/docker-nginx-unprivileged README, commits, issues #432 #434 #435
- openapi-ts/openapi-typescript issues #2874, #2723; PRs #2774, #2819, #2872
- cloudflare/cloudflared Dockerfile, `cmd/cloudflared/tunnel/subcommands.go`, PR #1135, #1746
- `https://pnpm.io/settings/peer-dependencies`, `/settings/build`, `/settings/dependency-resolution`
- TypeScript 6.0 release notes (typescriptlang.org)
- GitHub Advisory DB (`api.github.com/advisories?ecosystem=npm&affects=…`) for fastify, drizzle-orm, vite, ajv
