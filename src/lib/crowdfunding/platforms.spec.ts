import { describe, expect, it } from 'vitest';
import { hostOf, platformOf } from './platforms';

describe('platformOf', () => {
  it.each([
    ['https://www.catarse.me/projeto', 'catarse'],
    ['https://www.kickstarter.com/projects/a/b', 'kickstarter'],
    ['https://benfeitoria.com/rpg', 'benfeitoria'],
    ['https://gamefound.com/en/projects/x/y', 'gamefound'],
    ['https://example.com/x', 'other'],
  ])('reads %s as %s', (link, platform) => {
    expect(platformOf(link)).toBe(platform);
  });

  it('is not fooled by a host that only contains the name', () => {
    expect(platformOf('https://catarse.me.evil.example/x')).toBe('other');
    expect(platformOf('https://notkickstarter.com/x')).toBe('other');
  });

  it('is other for what is not an address', () => {
    expect(platformOf('nonsense')).toBe('other');
  });
});

describe('hostOf', () => {
  it('drops www.', () => {
    expect(hostOf('https://www.example.com/a')).toBe('example.com');
  });
});
