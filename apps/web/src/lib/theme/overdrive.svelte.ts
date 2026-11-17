import { flushSync } from 'svelte';
import {
  applyStyle,
  hintPending,
  markHintSeen,
  readStyle,
  reportTheme,
  type ThemeStyle,
} from './theme';
import { originOf, revealTheme } from './theme-transition';

/**
 * The Overdrive pedal, shared by every pedal on the page (sidebar, header, account menu): whether
 * `use_overdrive_theme` lets it show, and whether it is pressed.
 */
export const overdrive = $state({ allowed: false, on: false });

let hintClaimed = false;

/**
 * Called by the root layout with the flag. On: the pedal shows and a press remembered in this
 * browser stays. Off: no pedal, and the classic theme comes back without forgetting the press, so it
 * returns with the flag.
 */
export function initOverdrive(allowed: boolean): void {
  overdrive.allowed = allowed;
  overdrive.on = allowed && readStyle() === 'overdrive';
  applyStyle(overdrive.on ? 'overdrive' : 'classic', false);
}

/** A press: grows the other look from the pedal, remembers it and reports the change. */
export async function pressPedal(control?: Element | null): Promise<void> {
  const next: ThemeStyle = overdrive.on ? 'classic' : 'overdrive';
  // Someone who found the pedal needs no hint.
  markHintSeen();
  await revealTheme(
    () =>
      flushSync(() => {
        overdrive.on = next === 'overdrive';
        applyStyle(next);
      }),
    originOf(control),
  );
  reportTheme('changed');
}

/**
 * Whether this pedal may play the one-time "Pise aqui!": only the first visible pedal of the first
 * page that shows one, once per browser.
 */
export function claimHint(): boolean {
  if (hintClaimed || !hintPending()) return false;
  hintClaimed = true;
  markHintSeen();
  return true;
}

/** For specs: forget that this page already played the hint. */
export function resetHintClaim(): void {
  hintClaimed = false;
}
