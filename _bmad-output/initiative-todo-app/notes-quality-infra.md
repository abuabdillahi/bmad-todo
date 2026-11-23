# Testing, infrastructure and QA notes for the Todo App

<!-- Given by the user on 2026-11-23 as an addition to prd-todo-app.md; cited as qi T1–T5, qi D1–D4, qi Q1–Q4. Wording kept as given. -->

## Testing

- T1: Test scenarios for unit, integration and e2e tests are required.
- T2: Test infrastructure setup is required at the start, since testing will need to happen throughout development.
- T3: API endpoints need integration tests as they're being built, and Postman MCP or something similar should be used to validate the API contracts.
- T4: Component tests are needed, and Chrome DevTools MCP can be used to debug and inspect during development.
- T5: Use Playwright MCP to automate browser interactions. Cover: create todo, complete todo, delete todo, edit todo, empty state, error handling.

## Docker

- D1: Create Dockerfiles for frontend and backend with multi-stage builds, non-root users, and health checks.
- D2: Create a docker-compose.yml that orchestrates all containers (app, database if needed). Include proper networking, volume mounts, and environment configuration.
- D3: Implement health check endpoints. Ensure containers report health status and logs are accessible via docker-compose logs.
- D4: Support dev/test environments through environment variables and compose profiles.

## Quality

- Q1: Test coverage should be analysed and reported with gaps identified.
- Q2: Performance testing with Chrome DevTools MCP to analyze application performance. Document any issues found.
- Q3: Accessibility testing: run accessibility audits using Lighthouse or axe-core (can be automated via Playwright). Ensure WCAG AA compliance.
- Q4: Security review: review code for common security issues (XSS, injection, etc.).

## Direction

- Update the plan from the top down so everything is coherent and nothing is thoughtlessly bolted on.
