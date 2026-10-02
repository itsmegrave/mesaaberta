import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ICONS } from './registry';

describe('icon registry', () => {
  it('draws UI glyphs from Reicon, not Lucide, so they sit with the Game Icons', () => {
    const source = readFileSync('src/lib/icons/registry.ts', 'utf8');
    const packageJson = readFileSync('package.json', 'utf8');

    expect(source).not.toContain('@iconify-svelte/lucide');
    expect(packageJson).not.toContain('@iconify-svelte/lucide');
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
});
