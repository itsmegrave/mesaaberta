import { afterEach, describe, expect, it } from 'vitest';
import {
  MODE_COLOURS,
  OVERDRIVE_COLOURS,
  applyChoice,
  applyStyle,
  readChoice,
  readStyle,
} from './theme';

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-mode');
  document.documentElement.dataset.theme = 'cerberus';
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) meta.remove();
});

const mode = () => document.documentElement.dataset.mode;
const metas = () =>
  [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map((m) => m.content);

describe('applyChoice', () => {
  it('sets the mode on <html> and remembers a manual choice', () => {
    applyChoice('dark');

    expect(mode()).toBe('dark');
    expect(readChoice()).toBe('dark');
  });

  it('forgets the choice for "system" but still sets a mode from the system preference', () => {
    applyChoice('dark');
    applyChoice('system');

    expect(readChoice()).toBe('system');
    expect(localStorage.getItem('theme')).toBeNull();
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    expect(mode()).toBe(systemDark ? 'dark' : 'light');
  });

  it('paints the browser chrome in the chosen mode', () => {
    document.head.insertAdjacentHTML(
      'beforeend',
      '<meta name="theme-color" content="x" media="(prefers-color-scheme: light)"><meta name="theme-color" content="y" media="(prefers-color-scheme: dark)">',
    );
    applyChoice('dark');

    expect(metas().slice(-2)).toEqual([MODE_COLOURS.dark, MODE_COLOURS.dark]);
  });
});

describe('applyStyle', () => {
  it('puts Overdrive on <html>, remembers it and paints the chrome in its colours', () => {
    document.head.insertAdjacentHTML(
      'beforeend',
      '<meta name="theme-color" content="x" media="(prefers-color-scheme: light)"><meta name="theme-color" content="y" media="(prefers-color-scheme: dark)">',
    );
    applyChoice('dark');
    applyStyle('overdrive');
    expect(document.documentElement.dataset.theme).toBe('overdrive');
    expect(readStyle()).toBe('overdrive');
    expect(metas().slice(-2)).toEqual([OVERDRIVE_COLOURS.dark, OVERDRIVE_COLOURS.dark]);

    applyStyle('classic', false);
    expect(document.documentElement.dataset.theme).toBe('cerberus');
    expect(readStyle()).toBe('overdrive');
    applyStyle('classic');
    expect(readStyle()).toBe('classic');
  });
});
