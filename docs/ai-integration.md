# AI Integration: how BMad guided the Todo app build

I built this app with the BMad method (v7), running every BMad agent in Claude Code. In four days, a pasted PRD became two epics, 28 tickets and 36 merged pull requests. The agents' reasoning is logged in the memlogs under `_bmad-output/initiative-todo-app/`, and each epic has a retrospective.

## Agent usage

AI helped with almost every task, and BMad decided which agent did which part:

- **Sofia (product owner)** turned the PRD into requirements and constraints, split the work into two epics, and wrote, refined and closed every ticket. When I added testing, infrastructure, accessibility and QA goals partway through, she worked them back through the whole plan.
- **Winston (architect)** wrote 20 architecture decisions and checked every dependency version. He ruled out hosting on Cloudflare because its container disk is wiped on restart. When I offered my existing Hetzner host, he designed around it, with Cloudflare as a tunnel only.
- **Sally (UX)** drew four visual directions, refined one through five versions, and wrote DESIGN.md and EXPERIENCE.md. Her accessibility review found four critical issues, which is why deleting a todo now asks for confirmation.
- **build and build-auto** implemented every story in four steps: plan, code, review and verify. Most of epic 1 and all of epic 2 ran hands-off under an orchestrating agent.
- **retrospective** reviewed each finished epic against its tickets, plans and commits.

**Prompts that worked best:**

- **One explicit orchestration prompt.** It said the run was unattended, set the branch and PR rules, and started every Sofia or build call in a fresh context, so earlier work couldn't pollute it.
- **Asking one agent to write the next agent's prompt**, for example *"commit and give me prompts for Winston and Sofia"*.
- **Screenshots instead of just descriptions** for visual problems.

## MCP server usage

I didn't use any MCP server. The plan named Playwright, Chrome DevTools and Postman MCPs, but Winston's architecture kept MCPs out of CI so that the tests run with no agent present. Scripted tools did the same jobs:

- `@playwright/test` runs the browser tests.
- Playwright with the Chrome DevTools Protocol, plus Lighthouse, produced the performance profiles.
- An Ajv suite checks the API against its OpenAPI contract.

All of these run as committed code, in CI.

## Test generation

Sofia's `test-strategy.md` gave every test scenario an id, and each test's title carries its id. `coverage/scenarios.md` maps every id to the tests that cover it, so I could see coverage by behaviour as well as by line. When epic 2 closed, the suite had 309 unit, 173 component, 127 integration, 16 contract and 129 end-to-end tests. Every end-to-end test runs an axe accessibility scan, and coverage met the 70% goal.

**What the AI missed** (each one caught by a retrospective):

- 5 of epic 1's 12 end-to-end tests ran no axe scan, although the epic required one in every test.
- The client sent a new id when retrying a failed add, so the API's protection against duplicate todos never applied.
- Removing a feature also deleted the tests that guarded the deploy steps.

## Debugging with AI

- **Mockup spacing.** From my screenshots, Sally found that CSS resets were overriding the component styles, which removed the margins and broke button contrast. She fixed the resets with `:where()`.
- **Tests that failed only on CI.** On the slower runner, the same text appeared on screen and, one frame later, in a screen-reader region, so a test locator matched two elements. The agent narrowed the locators.
- **The "API down" test timed out.** The orchestrator traced it to nginx still holding the stopped API's cached address.
- **A design bug caught in review.** The story 1.6 review found that the revert logic for a failed save could undo later saves on the same todo. It was fixed before epic 2 built on it.

## Limitations: where human expertise was critical

**Over-building when left alone.** When the agents ran epic 2 hands-off, they added work this small app didn't need, and some solutions were too complex for the problem:

- **The epic doubled.** It was refined into 9 stories and finished with 19 tickets. The additions were mostly rare edge cases or extra deploy hardening, such as:
  - a shortened todo in a message splitting an emoji;
  - Shift+Enter while composing text with an input method editor;
  - Chrome losing an undo step when multi-line text is dropped into the field.
- **A complex fix for a rare case.** For "a burst of merges can leave main undeployed", an agent built a scheduled catch-up deploy. It came with an 8,500-word plan, a 500-line script and 900 lines of tests. GitHub never fired the schedule, so the feature was never seen working. I dropped the fix.
- **Tickets generating tickets.** The retrospective proposed 17 action items, and the agents filed many as backlog tickets, including tickets about their own review process. I dropped several as moot.

Other places where I was needed:

- **Platform behaviour.** The agents built on platform features, like GitHub's scheduled runs, before seeing them work.
- **Real devices.** I tested the add field on an Android phone to verify and reproduce a suspected bug.
- **Infrastructure.** I set up Cloudflare, the deploy's SSH access and the production secrets.
- **Judgement.** I chose the design, spotted that completed todos looked more active in dark mode, accepted the risks of a public URL with no backups, and settled disagreements between Sofia and Winston.
- **Review depth.** Story reviews were set to a single quick check that missed bugs between stories, until I tied review depth to each ticket's risk.

## Observations: the weight of the framework

Even in v7, BMad is heavy, and it produces many documents to review. I took the most detailed route with Sofia for the epics, with Winston for the architecture and with Sally for the UX. For an app with about 4,600 lines of source code, that produced:

- 116 Markdown files of about 233,000 words in `_bmad-output/`;
- about 31,000 words of planning documents;
- about 91,000 words of story plans.

I took the longer route on purpose, to get a good feel for the framework. It cost a lot of time, and it probably produced more detail and more documentation than the app needed.

The bigger cost was review fatigue. There was so much documentation and AI output that at times I skipped reading and verifying things I should have checked. That undermines the human checkpoints the framework relies on.

**What I'd do differently:**

- **For a small app like this:** a much lighter touch, with shorter planning, fewer documents and fewer review steps.
- **For something more complex:** a balance, with detail and due diligence where the risk is, but documentation kept at a level I can actually read, so everything gets reviewed and verified as it should be.

The amount of documentation and process was too much for an app this small. Next time I'd match the level of detail to the problem.
