import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from '@jest/globals';

const repositoryRoot = join(__dirname, '..', '..', '..');
const workflowPath = join(repositoryRoot, '.github', 'workflows', 'frontend-ci.yml');

function readWorkflow() {
  return readFileSync(workflowPath, 'utf8');
}

function expectInOrder(workflow: string, fragments: string[]) {
  const indexes = fragments.map((fragment) => workflow.indexOf(fragment));
  expect(indexes).not.toContain(-1);

  for (let index = 1; index < indexes.length; index += 1) {
    expect(indexes[index]).toBeGreaterThan(indexes[index - 1]);
  }
}

describe('frontend CI workflow', () => {
  it('runs the mobile frontend quality gate on push and pull request changes', () => {
    const workflow = readWorkflow();

    expect(workflow).toContain('push:');
    expect(workflow).toContain('pull_request:');

    for (const path of [
      '"src/**"',
      '"assets/**"',
      '"package.json"',
      '"package-lock.json"',
      '"app.json"',
      '".github/workflows/frontend-ci.yml"',
    ]) {
      expect(workflow).toContain(path);
    }
  });

  it('uses Node 22 and runs install, lint, typecheck, and Jest in band', () => {
    const workflow = readWorkflow();

    expect(workflow).toContain('actions/setup-node@v4');
    expect(workflow).toContain('node-version: "22"');
    expect(workflow).toContain('cache: "npm"');

    expectInOrder(workflow, [
      'run: npm ci',
      'run: npm run lint',
      'run: npm run typecheck',
      'run: npm test -- --runInBand',
    ]);
  });
});
