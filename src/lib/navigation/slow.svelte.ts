/**
 * A value that shows only once it has lasted `delay` ms: the page being navigated to, read by the
 * progress bar and the list skeletons, so a quick navigation does not make them flash. Create it
 * while a component is being set up (it runs an effect).
 */
export class Slow<T> {
  #late = $state(false);
  #read: () => T | null;

  constructor(read: () => T | null, delay: number) {
    this.#read = read;
    $effect(() => {
      if (read() === null) return;
      const timer = setTimeout(() => (this.#late = true), delay);
      return () => {
        clearTimeout(timer);
        this.#late = false;
      };
    });
  }

  get current(): T | null {
    return this.#late ? this.#read() : null;
  }
}
