/**
 * The row a dialog acts on. `open` follows `current`, so a dialog binds to it directly
 * (`bind:open={removing.open}`) and closing it clears the row.
 */
export class Target<T> {
  current = $state<T | null>(null);

  get open(): boolean {
    return this.current !== null;
  }

  set open(value: boolean) {
    if (!value) this.current = null;
  }
}
