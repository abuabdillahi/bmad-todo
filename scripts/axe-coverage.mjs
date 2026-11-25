#!/usr/bin/env node
// An axe scan in every e2e test (epic 1 Done when; AD-20): reads Playwright's
// JSON report and fails when a passed test, in any project, recorded no `axe`
// annotation. expectNoAxeViolations (e2e/axe.ts) adds one per scan. Skipped
// tests ran nothing, so they are listed but do not fail the check.
// Usage: node scripts/axe-coverage.mjs [report.json]
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const path = process.argv[2] ?? `${root}coverage/e2e-report.json`;

if (!existsSync(path)) {
  console.error(`axe coverage: no e2e report at ${path}. Run the e2e step first.`);
  process.exit(1);
}

const report = JSON.parse(readFileSync(path, 'utf8'));
const scanned = [];
const unscanned = [];
const skipped = [];

const walk = (suite) => {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests) {
      const result = test.results.at(-1);
      const name = `${spec.file}:${spec.line} [${test.projectName}] ${spec.title}`;
      if (!result || result.status === 'skipped') {
        skipped.push(name);
      } else if (result.status === 'passed') {
        const states = result.annotations
          .filter((annotation) => annotation.type === 'axe')
          .map((annotation) => annotation.description);
        (states.length > 0 ? scanned : unscanned).push({ name, states });
      }
      // A failed test already fails the e2e step, and may have stopped before its scan.
    }
  }
  for (const child of suite.suites ?? []) walk(child);
};
for (const suite of report.suites ?? []) walk(suite);

const scans = scanned.reduce((sum, { states }) => sum + states.length, 0);
console.log(`axe coverage: ${scanned.length} passed tests scanned (${scans} scans), ${unscanned.length} without a scan.`);
for (const name of skipped) console.log(`  skipped, not scanned: ${name}`);

if (unscanned.length > 0) {
  console.error('These e2e tests passed without an axe scan. Call expectNoAxeViolations (e2e/axe.ts) at each key state:');
  for (const { name } of unscanned) console.error(`  ${name}`);
  process.exit(1);
}
if (scanned.length === 0) {
  console.error('axe coverage: the e2e report has no passed test, so nothing was checked.');
  process.exit(1);
}
