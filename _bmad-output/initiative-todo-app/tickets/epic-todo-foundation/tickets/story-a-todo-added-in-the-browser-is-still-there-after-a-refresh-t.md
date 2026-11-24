---
id: 1
type: story
title: "A todo added in the browser is still there after a refresh, tested at every layer"
parent: epic-todo-foundation
covers: [R1, R2, R3, R8, R10, R11, R14, R15, R16, R17, R18]
after: []
hitl: true
risk: medium
tracker_id: "4"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/4"
tracker_status: done
---

# A todo added in the browser is still there after a refresh, tested at every layer

## Description

Tracer, after a person confirms the build machine's toolchain: the pnpm monorepo, contract package, Fastify API with GET and POST /api/todos on SQLite, React list and add form styled in light and dark, both Dockerfiles and the compose test profile, and the AD-20 harness for every layer behind pnpm test:all, with coverage, which story 2 runs in CI and deploys; the add waits for the server here (a failed add keeps its text and adds nothing) and moves onto AD-13's helper in story 6.

## Requirements

Verify: Run pnpm test:all: every layer runs in todo-test and passes, and E1 is green at phone and desktop width in both colour schemes. Bring up the test profile, open http://127.0.0.1:8081, add a todo, refresh, open a private window: it is there both times. The coverage report is written per Vitest project and by scenario id.

## References

- parent — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation.md
- test strategy — _bmad-output/initiative-todo-app/test-strategy.md: I1, I3, U2 whole; E1 create-and-reload (its 'appears at once' clause is story 6's); I7 healthy half (200 when storage is reachable); I9 for the success responses of GET /api/todos, POST /api/todos (201) and GET /api/health; K1 first clause (submits a valid description and clears itself); K6 for the add field and Add button; E7 for E1 (phone and desktop width); E8 for E1 (keyboard, axe-core in light and dark); R11's refresh and new-session parts (restart is story 7's I6)
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md: AD-2, AD-4 (same-origin /api through nginx, path unchanged; its 503 problem fallback is story 3), AD-5, AD-6 (GET, POST 201, health 200), AD-7, AD-10, AD-11 (one ['todos'] query in server order), AD-12, AD-15, AD-16 (test profile), AD-17 (health checks and restart policy for api and web-test), AD-19 (React escaping, Drizzle parameters, non-root images), AD-20 (every layer, Playwright projects for phone, desktop and dark, reducedMotion, coverage per Vitest project and by scenario id); Consistency Conventions; Stack; Structural Seed
- ux — _bmad-output/initiative-todo-app/ux-todo-app/DESIGN.md: Colors (light and dark), Typography, Layout & Spacing, Shapes, Components (Page heading, Add form, Todo list, Todo card text); EXPERIENCE.md: Foundation, Information Architecture, Component Patterns (Page heading, Add form submit, Todo list, Todo card text), Interaction Primitives (Focus management: Add valid, Page load), Component Patterns (Focus ring), Voice and Tone (Static strings and accessible names), Accessibility Floor (main landmark, lang, reflow at 320px); DESIGN.md Components (focus ring)
