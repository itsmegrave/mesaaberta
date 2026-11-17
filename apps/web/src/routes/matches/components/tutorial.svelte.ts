/** Where the browser keeps "Não mostrar de novo" for the Combinar tutorial. */
const KEY = 'combinar-tutorial-hidden';

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * The Combinar tutorial: opens by itself on every visit to the deck until the person ticks "Não
 * mostrar de novo" (kept in this browser), and again from "Como funciona". Call it while the
 * component initialises; it opens after mount.
 */
export function tutorialState() {
  let open = $state(false);
  let hide = $state(false);
  $effect(() => {
    if (!read()) open = true;
  });
  return {
    get open() {
      return open;
    },
    set open(value: boolean) {
      open = value;
      if (!value) {
        try {
          if (hide) localStorage.setItem(KEY, '1');
          else localStorage.removeItem(KEY);
        } catch {
          // Private windows may refuse storage: the tutorial just comes back next time.
        }
      }
    },
    get hide() {
      return hide;
    },
    set hide(value: boolean) {
      hide = value;
    },
    show() {
      hide = read();
      open = true;
    },
  };
}
