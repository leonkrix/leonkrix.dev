import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The workflow that compares the privacy policy of the WhyMail app with the copy on this site holds a
 * deploy key for a private repository. These checks keep it small and keep the key where it is: a
 * change that lets a pull request or another branch reach the secret fails here.
 */
const workflow = readFileSync(
  join(import.meta.dirname, '..', '..', '.github', 'workflows', 'whymail-policy.yml'),
  'utf8',
);

/** The part of the file before the jobs (the triggers and the permissions) */
const header = workflow.slice(0, workflow.indexOf('\njobs:'));
const uses = [...workflow.matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)].map((match) => match[1] ?? '');

describe('the workflow that compares the WhyMail policy', () => {
  it('runs only on a schedule and by hand, never for a pull request or a push', () => {
    const triggers = header.slice(header.indexOf('\non:'));
    expect(triggers).toContain('schedule:');
    expect(triggers).toContain('workflow_dispatch:');
    expect(triggers).not.toMatch(
      /pull_request|pull_request_target|push:|workflow_run|issue_comment/,
    );
  });

  it('has no permissions by default and asks for only two in its job', () => {
    expect(header).toMatch(/^permissions: \{\}$/m);
    const job = workflow.slice(workflow.indexOf('\njobs:'));
    const permissions = job.slice(job.indexOf('permissions:'), job.indexOf('steps:'));
    expect(permissions).toMatch(/contents: read/);
    expect(permissions).toMatch(/issues: write/);
    expect(permissions.match(/: (read|write)/g)).toHaveLength(2);
  });

  it('keeps the deploy key in the environment that only main may use, and uses it once', () => {
    expect(workflow).toMatch(/^\s+environment: whymail-policy$/m);
    expect(workflow.match(/secrets\.WHYMAIL_DEPLOY_KEY/g)).toHaveLength(1);
    expect(workflow).toMatch(/ssh-key: \$\{\{ secrets\.WHYMAIL_DEPLOY_KEY \}\}/);
    // Only the one file of the private repository is written to the runner, and nothing stays
    expect(workflow).toContain('sparse-checkout: docs/legal/privacy-policy.md');
    expect(workflow).not.toMatch(/persist-credentials: true/);
  });

  it('pins every action to a full commit', () => {
    expect(uses.length).toBeGreaterThan(0);
    for (const action of uses) {
      expect(action, action).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
    }
  });

  it('puts no value of an earlier step into the script, only into the environment', () => {
    const scripts = workflow.slice(workflow.indexOf('run: |'));
    expect(scripts).not.toMatch(/\$\{\{\s*(steps|inputs|github\.event)/);
  });

  it('puts no text of the policy into the issue', () => {
    expect(workflow).not.toMatch(/cat .*privacy-policy|privacy-policy\.md\)/);
    expect(workflow).toContain('sha256');
  });
});
