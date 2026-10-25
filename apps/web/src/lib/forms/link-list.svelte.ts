import { tick } from 'svelte';

/** The two parallel lists a form sends for its links: `linkNetwork[i]` goes with `linkUrl[i]`. */
export type LinkRows = { networks: string[]; urls: string[] };

export type LinkListOptions = {
  max: number;
  /** The network a new row starts with. */
  network: string;
  /** The id of a row's address field, focused once the row is added. */
  urlId: (id: number) => string;
  /** What the status line says once a row is removed, and once row `n` moved to `position`. */
  removed: () => string;
  moved?: (n: number, position: number) => string;
};

/**
 * A list of links to add to, remove from and reorder. Each row keeps an id of its own, so a row
 * that moves or is removed does not move what was typed in another, and keeps its focus.
 */
export class LinkList {
  /** One id per row, in the rows' order. */
  ids = $state<number[]>([]);
  /** Said by the list's status line after a row is removed or moved. */
  announcement = $state('');
  /** The add button: where the focus goes when the row that had it is removed. */
  addButton = $state<HTMLButtonElement>();
  #next = 0;
  #rows: LinkRows;
  #options: LinkListOptions;

  constructor(rows: LinkRows, options: LinkListOptions) {
    this.#rows = rows;
    this.#options = options;
    this.ids = rows.networks.map(() => this.#next++);
  }

  get canAdd() {
    return this.ids.length < this.#options.max;
  }

  add() {
    this.#rows.networks = [...this.#rows.networks, this.#options.network];
    this.#rows.urls = [...this.#rows.urls, ''];
    const id = this.#next++;
    this.ids.push(id);
    tick().then(() => document.getElementById(this.#options.urlId(id))?.focus());
  }

  remove(index: number) {
    this.#rows.networks = this.#rows.networks.filter((_, i) => i !== index);
    this.#rows.urls = this.#rows.urls.filter((_, i) => i !== index);
    this.ids.splice(index, 1);
    this.announcement = this.#options.removed();
    // The row that had the focus is gone: keep the focus in the list.
    tick().then(() => this.addButton?.focus());
  }

  move(index: number, by: -1 | 1) {
    const to = index + by;
    const swap = <T>(list: T[]) => {
      const copy = [...list];
      [copy[index], copy[to]] = [copy[to], copy[index]];
      return copy;
    };
    this.#rows.networks = swap(this.#rows.networks);
    this.#rows.urls = swap(this.#rows.urls);
    this.ids = swap(this.ids);
    this.announcement = this.#options.moved?.(index + 1, to + 1) ?? '';
  }
}
