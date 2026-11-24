import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { changedSince, defaultBase, plan, repoRoot, run, specsReadingDisk } from './verify.ts';

const root = '/repo';
const labels = (options: Parameters<typeof plan>[0]) => plan(options).steps.map((s) => s.label);
const base = {
  root,
  base: 'abc123',
  diskSpecs: ['packages/core/src/server/logger-fields.spec.ts'],
};

describe('verify: what a change runs', () => {
  it('runs everything when there is no merge base, instead of checking nothing', () => {
    const result = plan({ ...base, base: null, changed: [], existing: [] });
    expect(result.reason).toContain('no merge base');
    expect(result.steps.map((s) => s.label)).toEqual(['Lint', 'Typecheck', 'Unit tests']);
  });

  it('runs everything when the tooling, .gitignore or a stylesheet changed', () => {
    for (const file of [
      'eslint.config.js',
      '.gitignore',
      'apps/web/src/routes/layout.css',
      'bun.lock',
    ])
      expect(plan({ ...base, changed: [file], existing: [file] }).reason).toContain('tooling');
  });

  it('always runs the specs that read sources from disk next to the reachable ones', () => {
    const steps = plan({
      ...base,
      changed: ['apps/web/src/a.ts'],
      existing: ['apps/web/src/a.ts'],
    }).steps;
    const disk = steps.find((s) => s.label.includes('read files from disk'));
    expect(disk?.cmd).toContain('/repo/packages/core/src/server/logger-fields.spec.ts');
  });

  it('runs every unit spec when a data file changed, which imports cannot reach', () => {
    const file = 'apps/web/messages/pt-BR.json';
    expect(labels({ ...base, changed: [file], existing: [file] })).toContain(
      'Unit tests (all: a data or style file changed)',
    );
  });

  it('typechecks when messages change, since they feed generated types', () => {
    const file = 'apps/web/messages/pt-BR.json';
    expect(labels({ ...base, changed: [file], existing: [file] })).toContain('Typecheck');
  });

  it('skips the typecheck and ESLint when only Markdown changed', () => {
    const steps = labels({ ...base, changed: ['README.md'], existing: ['README.md'] });
    expect(steps).not.toContain('Typecheck');
    expect(steps).not.toContain('ESLint');
  });

  it('still typechecks when a module was deleted', () => {
    expect(labels({ ...base, changed: ['apps/web/src/gone.ts'], existing: [] })).toContain(
      'Typecheck',
    );
  });

  it('runs one kind of check for each CI job', () => {
    const changed = ['apps/web/src/a.ts'];
    expect(labels({ ...base, changed, existing: changed, lint: true })).toEqual([
      'Prettier',
      'ESLint',
    ]);
    expect(labels({ ...base, changed, existing: changed, tests: true })).not.toContain('Prettier');
  });
});

describe('verify: reading git', () => {
  const here = repoRoot(process.cwd()) as string;
  const temp = mkdtempSync(path.join(tmpdir(), 'verify-spec-'));
  afterAll(() => rmSync(temp, { recursive: true, force: true }));

  it('fails loudly on a base git cannot resolve, rather than passing with nothing changed', () => {
    expect(() => changedSince(here, '0000000000000000000000000000000000000000')).toThrow(/failed/);
  });

  it('has no default base in a repository without origin/main', () => {
    run(['git', 'init', '-q'], temp);
    expect(defaultBase(temp)).toBeNull();
  });

  it('finds the guard specs that read sources from disk', () => {
    const specs = specsReadingDisk(here);
    expect(specs).toContain('packages/core/src/server/extensions/boundary.spec.ts');
    expect(specs.some((file) => file.includes('.integration.'))).toBe(false);
  });
});
