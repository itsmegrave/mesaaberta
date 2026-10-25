import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ICONS } from './registry';

describe('icon registry', () => {
  it('draws UI glyphs from Reicon, not Lucide, so they sit with the Game Icons', () => {
    const source = readFileSync('src/lib/icons/registry.ts', 'utf8');
    const packageJson = readFileSync('../../package.json', 'utf8');

    expect(source).not.toContain('@iconify-svelte/lucide');
    expect(packageJson).not.toContain('@iconify-svelte/lucide');
  });

  it('uses the Filled Reicon weight, except for the line-only glyphs', () => {
    const source = readFileSync('src/lib/icons/registry.ts', 'utf8');
    const lineOnly = new Set([
      'add',
      'minus',
      'arrow-left',
      'arrow-right',
      'arrow-up-right-square',
      'check',
      'xmark',
      'chevron-down',
      'chevron-left',
      'chevron-right',
      'text-bold',
      'italic',
      'underline',
      'list',
      'quote-up',
      'code',
      'link',
      'link-broken',
      'undo',
      'redo',
    ]);
    const plain = [...source.matchAll(/@iconify-svelte\/reicon\/([a-z0-9-]+)'/g)]
      .map((match) => match[1])
      .filter((name) => !name.endsWith('-filled') && !lineOnly.has(name));

    expect(plain).toEqual([]);
  });

  it('has no speech-bubble icon: messaging is the scroll and quill', () => {
    expect(Object.keys(ICONS)).not.toContain('message-circle');
    expect(Object.keys(ICONS)).toContain('game-icons:scroll-quill');
  });

  it('has the navigation icons the design names', () => {
    expect(Object.keys(ICONS)).toEqual(
      expect.arrayContaining([
        'game-icons:tavern-sign',
        'game-icons:dice-twenty-faces-twenty',
        'game-icons:tabletop-players',
        'game-icons:house',
        'game-icons:bar-stool',
      ]),
    );
    expect(Object.keys(ICONS)).not.toContain('game-icons:card-draw');
  });

  it('draws every person as the meeple, without separate user icons', () => {
    const names = Object.keys(ICONS);

    expect(names).toContain('game-icons:meeple');
    for (const gone of ['user-plus', 'user-check', 'user-x', 'user-minus', 'users']) {
      expect(names).not.toContain(gone);
    }
  });
});
