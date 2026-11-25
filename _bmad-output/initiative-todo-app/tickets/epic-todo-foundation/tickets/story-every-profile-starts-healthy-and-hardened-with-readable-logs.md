---
id: 7
type: story
title: "Every profile starts healthy and hardened, with readable logs, and todos survive a restart"
parent: epic-todo-foundation
covers: [R11, R15, R16, R17, R20]
after: [2, 3]
hitl: false
risk: low
tracker_id: "10"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/10"
tracker_status: in-progress
---

# Every profile starts healthy and hardened, with readable logs, and todos survive a restart

## Description

Adds the dev profile, startup config validation and a complete .env.example, log rotation and pino request ids on every service, nginx's CSP and security headers, and I6's restart proof, on top of story 2's prod services and story 3's API and nginx config.

## Requirements

Verify: docker compose -p todo-dev --profile dev up -d --wait shows every service healthy and http://127.0.0.1:5173 reloads on a source change; on the test profile, the API logs are JSON lines with request ids and no todo text, and a response from http://127.0.0.1:8081 carries the Content-Security-Policy header; starting the API with an invalid PORT exits with an error; pnpm test:all passes I6.

## References

- parent — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation.md
- test strategy — _bmad-output/initiative-todo-app/test-strategy.md: I6 whole; R11's restart part
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md: AD-2 (one replica), AD-4 (the Vite dev proxy forwards /api unchanged; api-dev publishes no port and enables no CORS), AD-16 (dev profile, env validated at startup with a non-zero exit, .env.example), AD-17 (web-dev and api-dev health checks, json-file rotation on every service, pino JSON with a request id), AD-19 (CSP default-src 'self' and the standard headers, no todo text in logs at info, no secrets in images or compose)
