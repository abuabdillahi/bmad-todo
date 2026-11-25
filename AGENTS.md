# Agent instructions

## Git

- Build every story, feature or fix on a new feature branch named after it (for example `story-1-2-deploy`), never on `main`, and merge it into `main` by pull request. Do not ask whether to branch: always branch. A push to `main` runs the deploy job and changes production.
- Exception, board bookkeeping: a commit that changes only files under `_bmad-output/` (closing or moving a ticket, mirroring tracker status, a retrospective) may be committed on `main` and pushed straight to `origin/main`. Its message must contain `[skip ci]`, so the push runs no CI and no deploy. Push it on its own, never with code commits, and check first that `git diff --name-only origin/main..main` lists only `_bmad-output/` paths.
