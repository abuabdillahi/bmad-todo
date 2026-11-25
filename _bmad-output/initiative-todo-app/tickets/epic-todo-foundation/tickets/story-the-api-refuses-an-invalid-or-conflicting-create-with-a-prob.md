---
id: 3
type: story
title: "The API refuses an invalid or conflicting create with a problem response"
parent: epic-todo-foundation
covers: [R10, R12, R15, R17, R20]
after: [1]
hitl: false
risk: medium
tracker_id: "6"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/6"
tracker_status: done
---

# The API refuses an invalid or conflicting create with a problem response

## Description

Adds AD-8's strict validation and the shared description.ts check (which story 4 imports), the one Problem schema with all five type URIs and one error handler, the idempotent create replay and 409, the unhealthy health answer, and nginx's 503 unavailable problem, all documented in openapi.json; story 5 classifies these problems on the client, and story 7 adds config validation and headers to the same API and nginx config.

## Requirements

Verify: pnpm test:all passes and lists a passing test for each of U1, I2, I7, I8, I9, I10 and I11. With the test profile up and the api container stopped, http://127.0.0.1:8081/api/todos answers the unavailable problem JSON, not an HTML page.

## References

- parent — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation.md
- test strategy — _bmad-output/initiative-todo-app/test-strategy.md: U1, I2, I10 whole; I7 unhealthy half (503 unavailable when storage is unreachable); I8 for create and list; I9 for the error responses of create, list and health (400, 409, the 200 replay, 503); I11 create half, control-character rejection included
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md: AD-4 (the /api 503 problem from nginx), AD-5 (description.ts, the one runtime import the web may make), AD-6 (POST 200 replay and 409; 503 documented on every route), AD-8 (server side, and the client check in description.ts), AD-9 (Problem schema, all five types, one error handler, no stack, SQL or todo text), AD-10 (service owns replay), AD-15 (atomic create)
