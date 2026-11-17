export type ThemeChoice = 'system' | 'light' | 'dark';
export type Mode = 'light' | 'dark';
/** The look: the classic theme (Cerberus) or Overdrive, whose light mode is Gibi and dark is Neon. */
export type ThemeStyle = 'classic' | 'overdrive';

/** The page background of each mode, for the browser's own chrome. Keep in step with src/app.html. */
export const MODE_COLOURS: Record<Mode, string> = {
  light: '#fcfcfc',
  dark: '#121212',
};

/** The same for Overdrive (Gibi's paper, Neon's night). Keep in step with src/app.html. */
export const OVERDRIVE_COLOURS: Record<Mode, string> = {
  light: '#fff8ec',
  dark: '#140a24',
};

/** The Skeleton theme (`data-theme` on <html>) of each look. */
export const THEME_NAMES: Record<ThemeStyle, string> = {
  classic: 'cerberus',
  overdrive: 'overdrive',
};

const KEY = 'theme';
/** Where the pedal is remembered; read before the first paint by src/app.html too. */
export const STYLE_KEY = 'theme-style';
/** The day the theme in use was last reported, so it is counted once a day per browser. */
const REPORTED_KEY = 'theme-reported';
/** Set once the pedal's one-time "Pise aqui!" has played, wherever it played. */
export const HINT_KEY = 'overdrive-hint-seen';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Blocked storage: the change still applies to this page, it just is not remembered.
  }
}

/** The mode a choice means: a manual choice wins, "system" follows the browser. */
export function resolveMode(choice: ThemeChoice, systemPrefersDark: boolean): Mode {
  if (choice === 'system') return systemPrefersDark ? 'dark' : 'light';
  return choice;
}

/** What the reader chose and the browser remembered. Storage can be blocked, so this never throws. */
export function readChoice(): ThemeChoice {
  const stored = read(KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

/** Whether the pedal was pressed in this browser. Only applies while `use_overdrive_theme` is on. */
export function readStyle(): ThemeStyle {
  return read(STYLE_KEY) === 'overdrive' ? 'overdrive' : 'classic';
}

/** The look on screen now, from <html>. */
export function currentStyle(): ThemeStyle {
  return document.documentElement.dataset.theme === THEME_NAMES.overdrive ? 'overdrive' : 'classic';
}

function paintChrome(choice: ThemeChoice): void {
  const colours = currentStyle() === 'overdrive' ? OVERDRIVE_COLOURS : MODE_COLOURS;
  const mode = document.documentElement.dataset.mode === 'dark' ? 'dark' : 'light';
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const scheme = meta.media.includes('dark') ? 'dark' : 'light';
    meta.content = colours[choice === 'system' ? scheme : mode];
  }
}

/**
 * Applies and remembers a choice. The page is always in one mode: `data-mode` on `<html>` is `light`
 * or `dark` (the stylesheet's `dark:` variant reads it). "system" forgets the choice and takes the
 * mode from `prefers-color-scheme`. The choice lives in localStorage, not a cookie, so it needs no
 * banner and never leaves the browser.
 */
export function applyChoice(choice: ThemeChoice): void {
  write(KEY, choice === 'system' ? null : choice);
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.mode = resolveMode(choice, systemDark);
  paintChrome(choice);
}

/**
 * Puts a look on <html> (`data-theme`). `remember` stores the pedal; the layout passes false when it
 * only takes Overdrive away because `use_overdrive_theme` is off, so the press comes back with the
 * flag.
 */
export function applyStyle(style: ThemeStyle, remember = true): void {
  if (remember) write(STYLE_KEY, style === 'overdrive' ? 'overdrive' : null);
  document.documentElement.dataset.theme = THEME_NAMES[style];
  paintChrome(readChoice());
  paintFavicon(style);
}

/** The tab's icon: Overdrive's sticker while it paints, the classic monogram otherwise. */
function paintFavicon(style: ThemeStyle): void {
  const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/svg+xml"]');
  if (!icon) return;
  const name = style === 'overdrive' ? 'favicon-overdrive.svg' : 'favicon.svg';
  icon.href = icon.href.replace(/favicon(-overdrive)?\.svg$/, name);
}

/** The theme in use, as the analytics event and the person's profile carry it. */
export function themeReport(): { theme: ThemeStyle; theme_choice: ThemeChoice; theme_mode: Mode } {
  return {
    theme: currentStyle(),
    theme_choice: readChoice(),
    theme_mode: document.documentElement.dataset.mode === 'dark' ? 'dark' : 'light',
  };
}

/**
 * Tells the server which theme is on screen (`/api/theme`): `changed` after a press of the pedal or the
 * light/dark switch, `in_use` at most once a day per browser. Best effort: a failure is dropped.
 * The server records it for signed-in people only.
 */
export function reportTheme(kind: 'changed' | 'in_use', today = new Date()): void {
  const day = today.toISOString().slice(0, 10);
  if (kind === 'in_use' && read(REPORTED_KEY) === day) return;
  write(REPORTED_KEY, day);
  void fetch('/api/theme', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind, ...themeReport() }),
    keepalive: true,
  }).catch(() => {});
}

/** Whether the pedal's one-time hint is still to play in this browser. */
export function hintPending(): boolean {
  return read(HINT_KEY) === null;
}

export function markHintSeen(): void {
  write(HINT_KEY, '1');
}
