import { invalidateAll } from '$app/navigation';
import { createMutation } from '@tanstack/svelte-query';
import { untrack } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';
import type { MatchPerson } from '@mesaaberta/core/server/matches/service';
import { postAction } from '#lib/forms/action.js';
import { m } from '#lib/paraglide/messages.js';
import { queryClient } from '#lib/query/context.js';
import { toast } from '#lib/toaster.js';

/** How far (px) a card has to be dragged to count as an answer. */
export const SWIPE_AT = 110;

/**
 * The deck on the page: the cards still to answer (the load's, less the ones answered here), the
 * answers and Voltar a última, and the person a yes just matched with. Answers post to the page's
 * actions; the next batch is read again when the cards run out. Call it while the component
 * initialises.
 */
export function deckState(cards: () => MatchPerson[], left: () => number) {
  const client = queryClient();
  const answered = new SvelteSet<string>();
  let history = $state<string[]>([]);
  let matched = $state<MatchPerson | null>(null);
  /** The last answer's side, for the way the card leaves. */
  let exit = $state<'yes' | 'no' | null>(null);
  let used = $state(0);

  // A fresh load already leaves out what was answered and counts it in what is left.
  $effect.pre(() => {
    cards();
    untrack(() => {
      answered.clear();
      used = 0;
    });
  });

  const people = $derived(cards().filter((person) => !answered.has(person.username)));

  const answering = createMutation(
    () => ({
      mutationFn: ({ username, yes }: { username: string; yes: boolean }) => {
        const data = new FormData();
        data.set('username', username);
        data.set('yes', String(yes));
        return postAction('?/answer', data);
      },
      retry: false,
    }),
    () => client,
  );
  const undoing = createMutation(
    () => ({ mutationFn: () => postAction('?/undo', new FormData()), retry: false }),
    () => client,
  );

  async function answer(yes: boolean) {
    const top = people[0];
    if (!top || answering.isPending) return;
    // The card leaves at once; a refusal brings the deck back from the server.
    exit = yes ? 'yes' : 'no';
    answered.add(top.username);
    history = [...history, top.username];
    used += 1;
    try {
      const result = await answering.mutateAsync({ username: top.username, yes });
      if (result.type === 'success') {
        const match = (result.data as { match?: { person: MatchPerson } | null } | undefined)
          ?.match;
        if (match) matched = match.person;
      } else if (result.type === 'failure' && result.status === 429) {
        toast.error(m.match_limit_reached());
        await invalidateAll();
      } else if (result.type === 'failure' && result.status === 404) {
        // They switched off or blocked meanwhile: the card is just gone.
      } else {
        throw new Error('answer failed');
      }
    } catch {
      answered.delete(top.username);
      history = history.slice(0, -1);
      used -= 1;
      toast.error(m.match_answer_failed());
    }
    if (people.length === 0 && left() - used > 0) await invalidateAll();
  }

  async function undo() {
    if (undoing.isPending) return;
    // The card on top steps aside for the one coming back, without flying.
    exit = null;
    try {
      const result = await undoing.mutateAsync();
      if (result.type !== 'success') throw new Error('undo failed');
      const last = history.at(-1);
      if (last) {
        answered.delete(last);
        history = history.slice(0, -1);
      }
      used = Math.max(0, used - 1);
      await invalidateAll();
    } catch {
      toast.error(m.match_answer_failed());
    }
  }

  return {
    get people() {
      return people;
    },
    /** Answers given here since the load. */
    get used() {
      return used;
    },
    get exit() {
      return exit;
    },
    get matched() {
      return matched;
    },
    get busy() {
      return answering.isPending || undoing.isPending;
    },
    /** Whether Voltar a última has something to take back (an answer given today). */
    canUndo(fromLoad: boolean) {
      return fromLoad || history.length > 0;
    },
    answer,
    undo,
    closeMatch() {
      matched = null;
    },
  };
}

/**
 * Drags a card sideways (or up for Ver mais) with a pointer. The offset is set on the element by
 * script (the CSP refuses inline style attributes, not CSSOM writes). `onmove` reports the offset,
 * for the stamp; letting go past SWIPE_AT answers, short of it the card springs back.
 */
export function swipe(
  options: () => {
    onmove: (dx: number) => void;
    onanswer: (yes: boolean) => void;
    onmore: () => void;
    disabled: boolean;
  },
) {
  return (node: HTMLElement) => {
    let start: { x: number; y: number; id: number } | null = null;
    let dx = 0;
    let dy = 0;
    const place = (x: number, y: number, settle = false) => {
      node.style.transition = settle ? 'transform 180ms ease-out' : 'none';
      node.style.transform = x || y ? `translate(${x}px, ${y}px) rotate(${x / 18}deg)` : '';
    };
    const down = (event: PointerEvent) => {
      if (options().disabled || event.button !== 0) return;
      // Buttons and links inside the card keep their own clicks.
      if ((event.target as HTMLElement).closest('a, button')) return;
      start = { x: event.clientX, y: event.clientY, id: event.pointerId };
      node.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.id) return;
      dx = event.clientX - start.x;
      dy = Math.min(0, event.clientY - start.y);
      place(dx, dy);
      options().onmove(dx);
    };
    const up = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.id) return;
      start = null;
      const { onanswer, onmore, onmove } = options();
      const answered = Math.abs(dx) >= SWIPE_AT;
      // An answered card flies on from where it was let go (`throwCard` reads the offset); one the
      // deck did not take (still busy) springs back.
      node.dataset.dx = String(dx);
      if (answered) onanswer(dx > 0);
      else if (-dy >= SWIPE_AT) onmore();
      dx = 0;
      dy = 0;
      onmove(0);
      if (!answered) place(0, 0, true);
      else
        setTimeout(() => {
          if (!node.dataset.leaving) place(0, 0, true);
        }, 60);
    };
    node.addEventListener('pointerdown', down);
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', up);
    return () => {
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', up);
    };
  };
}
