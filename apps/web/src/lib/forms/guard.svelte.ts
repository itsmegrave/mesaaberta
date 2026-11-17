import { beforeNavigate, goto } from '$app/navigation';
import { onMount } from 'svelte';
import { confirmLeave, reloadAllowed, trackDraft } from './leave-guard.svelte';

/** Query refreshes never reset drafts; only a confirmed save changes the baseline. */
export function guardDraft(form: { readonly dirty: boolean; readonly pending: boolean }) {
  let allowed = false;
  beforeNavigate((navigation) => {
    if (navigation.shallow && navigation.type === 'goto') return;
    if (allowed || form.pending || !form.dirty || navigation.willUnload) return;
    navigation.cancel();
    void confirmLeave().then(async (leave) => {
      if (!leave || !navigation.to) return;
      allowed = true;
      try {
        await goto(navigation.to.url);
      } finally {
        allowed = false;
      }
    });
  });
  onMount(() => {
    const untrack = trackDraft(() => !form.pending && form.dirty);
    const unload = (event: BeforeUnloadEvent) => {
      if (!reloadAllowed() && !form.pending && form.dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', unload);
    return () => {
      untrack();
      window.removeEventListener('beforeunload', unload);
    };
  });
}
