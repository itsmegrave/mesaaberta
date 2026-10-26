// What a pick-from-a-list field knows, whatever draws it: the list narrowed by what was typed (the
// first 80 of it, plus the "Sugerir" option), the picks and how to name them. SearchSelect draws it
// as a combobox or a short list on a wide screen and as a bottom sheet on a phone (SelectSheet).
import { foldForSearch, matchesSearch } from '#lib/search.js';
import { NEW_CATALOG_PREFIX, SUGGESTION_NAME, pickName } from '@mesaaberta/core/tables/catalog';

/** `pending`: an entry not approved yet, marked with the field's `pendingLabel`. */
export type SelectItem = { name: string; slug: string; pending?: true };

/** Rendering all ~700 systems at once is slow on a phone; typing narrows the rest. */
export const SHOWN = 80;

/** Past this many options the list gets a search box; up to it, type-ahead is enough. */
export const SEARCH_FROM = 11;

/** Wide enough for the list under the field (Tailwind's `md`); narrower gets the bottom sheet. */
export const WIDE = '(min-width: 48rem)';

type Source = {
  items: SelectItem[];
  value: string[];
  multiple: boolean;
  summary: boolean;
  suggestLabel?: (name: string) => string;
  pendingLabel: string;
  /** Takes the new picks: the field's bindable `value`. */
  set: (next: string[]) => void;
  onchange?: (value: string[]) => void;
};

export class SelectState {
  // Replaced in the constructor; the derived fields below only read it once the field renders.
  #source: () => Source = () => {
    throw new Error('SelectState read before it was set up');
  };

  /** What is being typed into the search, if anything. */
  typed = $state<string | null>(null);

  constructor(source: () => Source) {
    this.#source = source;
  }

  get value() {
    return this.#source().value;
  }

  nameOf = (slug: string) => pickName(this.#source().items, slug);

  /** A pick not approved yet: a pending entry, or a name suggested just now. */
  isPending = (slug: string) =>
    slug.startsWith(NEW_CATALOG_PREFIX) ||
    this.#source().items.some((item) => item.slug === slug && item.pending);

  chipName = (slug: string) => {
    const { pendingLabel } = this.#source();
    return this.isPending(slug) && pendingLabel
      ? `${this.nameOf(slug)} (${pendingLabel})`
      : this.nameOf(slug);
  };

  /** Several picks shown closed as the first one and "+N": "Discord +1". */
  summarized = $derived.by(() => {
    const value = this.#source().value;
    return value.length > 1
      ? `${this.nameOf(value[0])} +${value.length - 1}`
      : this.nameOf(value[0]);
  });

  /** What the closed field shows: the pick, the summary of several, or nothing. */
  shown = $derived.by(() => {
    const { value, multiple, summary } = this.#source();
    if (!value[0]) return '';
    if (!multiple) return this.nameOf(value[0]);
    return summary ? this.summarized : '';
  });

  matching = $derived(
    this.#source().items.filter((item) => matchesSearch(item.name, this.typed ?? '')),
  );

  /** What was typed, tidied, when it can be suggested: long enough and not a name the list has. */
  suggestion = $derived.by((): SelectItem | null => {
    const { items, suggestLabel } = this.#source();
    const name = (this.typed ?? '').trim().replace(/\s+/g, ' ');
    if (!suggestLabel) return null;
    if (name.length < SUGGESTION_NAME.min || name.length > SUGGESTION_NAME.max) return null;
    if (items.some((item) => foldForSearch(item.name) === foldForSearch(name))) return null;
    return { name: suggestLabel(name), slug: `${NEW_CATALOG_PREFIX}${name}` };
  });

  /** The options drawn: the first matches, then the suggestion. */
  options = $derived([
    ...this.matching.slice(0, SHOWN),
    ...(this.suggestion ? [this.suggestion] : []),
  ]);

  /** How many matches are left out of the list. */
  hidden = $derived(Math.max(0, this.matching.length - SHOWN));

  commit = (next: string[]) => {
    const { set, onchange } = this.#source();
    set(next);
    // The hidden inputs follow `value` on the next render; the change is announced after that.
    queueMicrotask(() => onchange?.(next));
  };

  remove = (slug: string) => this.commit(this.value.filter((picked) => picked !== slug));
}
