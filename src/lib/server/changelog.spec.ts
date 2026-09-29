import { describe, expect, it } from 'vitest';
import { changelog } from './changelog';

describe('the changelog entries in the repo', () => {
  // Importing the module parses every file: a broken entry fails here, before it reaches a build.
  it('all parse, and start with the launch', () => {
    expect(changelog.length).toBeGreaterThan(0);
    expect(changelog.at(-1)).toMatchObject({ date: '2026-09-29', draft: false });
  });
});
