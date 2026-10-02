import { beforeNavigate, goto } from '$app/navigation';
import { onMount } from 'svelte';
import { confirmLeave } from './leave-guard.svelte';

/** Query refreshes never reset drafts; only a confirmed save changes the baseline. */
export function guardDraft(form: { readonly dirty: boolean; readonly pending: boolean }) {
  let allowed = false;
  beforeNavigate((navigation) => {
    if (allowed || form.pending || !form.dirty || navigation.willUnload) return;
    navigation.cancel();
    void confirmLeave().then(async (leave) => {
      if (!leave || !navigation.to) return;
      allowed = true;
      try {
        // eslint-disable-next-line svelte/no-navigation-without-resolve -- SvelteKit already resolved this navigation URL.
        await goto(navigation.to.url);
      } finally {
        allowed = false;
      }
    });
  });
  onMount(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (!form.pending && form.dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  });
}
