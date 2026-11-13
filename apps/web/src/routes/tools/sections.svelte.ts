import { untrack } from 'svelte';
import { MediaQuery } from 'svelte/reactivity';

/** How far a finger must travel sideways (px) before a swipe turns the section. */
const SWIPE = 60;

/**
 * Which sections of Ferramentas are open. On a wide screen every section starts open and each
 * folds on its own. On a phone the sections are pages: one is open at a time, and the chips above,
 * the "Anterior / Próxima" buttons under it and a sideways swipe move between them.
 *
 * Every section renders open first (the server cannot know the width), and on a phone the others
 * fold once the page runs: they are below the first one, so nothing above the reader moves.
 */
export class ToolSections {
  readonly #kinds: () => readonly string[];
  // 48rem is Tailwind's `md`, as in MAAccordion.
  readonly #wide = new MediaQuery('min-width: 48rem', false);
  #open = $state<string[]>([]);
  #touch: { x: number; y: number } | null = null;

  constructor(kinds: () => readonly string[]) {
    this.#kinds = kinds;
    this.#open = [...kinds()];
    // On a new list (a search) or a new width: every section open on a wide screen; on a phone the
    // one that was showing, or the first.
    $effect(() => {
      const shown = kinds();
      const paged = this.paged;
      untrack(() => {
        const kept = shown.find((kind) => this.#open.includes(kind)) ?? shown[0];
        this.#open = paged ? (kept ? [kept] : []) : [...shown];
      });
    });
  }

  /** One section at a time: a phone. */
  get paged() {
    return !this.#wide.current;
  }

  /** The open sections, as MAAccordion's `value`. */
  get open(): string[] {
    return this.#open;
  }

  /** MAAccordion's change: on a phone, opening one folds the one that was open. */
  set open(next: string[]) {
    if (!this.paged) {
      this.#open = next;
      return;
    }
    const added = next.filter((kind) => !this.#open.includes(kind));
    this.#open = added.length > 0 ? added.slice(-1) : next;
  }

  /** The section a phone shows (the first open one). */
  get current(): string | undefined {
    const kinds = this.#kinds();
    return kinds.find((kind) => this.#open.includes(kind));
  }

  /** Where the current section is among them, from 0 (-1 when every one is folded). */
  get index() {
    const current = this.current;
    return current ? this.#kinds().indexOf(current) : -1;
  }

  /** Open this section alone and bring its heading into view. */
  show(kind: string) {
    this.#open = [kind];
    queueMicrotask(() => {
      const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
      document
        .getElementById(`tools-${kind}`)
        ?.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' });
    });
  }

  /** The section before (-1) or after (1) the current one, if there is one. */
  neighbour(direction: 1 | -1): string | undefined {
    const index = this.index;
    return index < 0 ? undefined : this.#kinds()[index + direction];
  }

  step(direction: 1 | -1) {
    const next = this.neighbour(direction);
    if (next) this.show(next);
  }

  /** A sideways swipe over an open section turns to the next or the previous one (phones). */
  readonly swipe = {
    ontouchstart: (event: TouchEvent) => {
      const touch = event.touches[0];
      this.#touch = this.paged && touch ? { x: touch.clientX, y: touch.clientY } : null;
    },
    ontouchend: (event: TouchEvent) => {
      const start = this.#touch;
      const touch = event.changedTouches[0];
      this.#touch = null;
      if (!start || !touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      // Mostly sideways, so a scroll down the page never turns it.
      if (Math.abs(dx) >= SWIPE && Math.abs(dx) > 2 * Math.abs(dy)) this.step(dx < 0 ? 1 : -1);
    },
  };
}
