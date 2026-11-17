/**
 * Loads Cloudflare Turnstile once per page and renders a widget into `node`, which writes its
 * answer to a hidden `captchaToken` input inside the form. `reset` gets a fresh answer after a
 * submit, since each one is good for a single check.
 */
type Turnstile = {
  render: (node: HTMLElement, options: Record<string, unknown>) => string | undefined;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading: Promise<Turnstile> | null = null;

function load(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT;
    script.async = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile missing'));
    script.onerror = () => {
      loading = null;
      reject(new Error('turnstile unavailable'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export function captchaWidget(siteKey: string) {
  let api: Turnstile | null = null;
  let id: string | undefined;
  let failed = $state(false);

  return {
    get failed() {
      return failed;
    },
    /** Svelte attachment: renders the widget into the node and removes it when the node goes. */
    attach(node: HTMLElement) {
      let gone = false;
      load()
        .then((turnstile) => {
          if (gone) return;
          api = turnstile;
          id = turnstile.render(node, {
            sitekey: siteKey,
            'response-field-name': 'captchaToken',
            language: 'pt-br',
            theme: 'auto',
            size: 'flexible',
          });
        })
        .catch(() => (failed = true));
      return () => {
        gone = true;
        if (api && id) api.remove(id);
        id = undefined;
      };
    },
    reset() {
      if (api && id) api.reset(id);
    },
  };
}
