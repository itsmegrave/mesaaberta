import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ENTRY_FILES } from '$lib/changelog/entries.generated';
import { changelog } from './changelog';

const DIR = 'src/content/changelog';

describe('the changelog entries in the repo', () => {
  // Importing the module parses every file: a broken entry fails here, before it reaches a build.
  it('all parse, and start with the launch', () => {
    expect(changelog.length).toBeGreaterThan(0);
    expect(changelog.at(-1)).toMatchObject({ date: '2026-09-29', draft: false });
  });

  it('are all in the generated module, as written (run `pnpm changelog` if not)', () => {
    const onDisk = Object.fromEntries(
      readdirSync(DIR)
        .filter((name) => name.endsWith('.md'))
        .map((name) => [name, readFileSync(`${DIR}/${name}`, 'utf8')]),
    );
    expect(ENTRY_FILES).toEqual(onDisk);
  });
});
