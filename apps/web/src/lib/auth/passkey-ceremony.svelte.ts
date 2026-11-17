import { applyAction, type ActionResult } from '$app/forms';
import { createMutation } from '@tanstack/svelte-query';
import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  WebAuthnError,
} from '@simplewebauthn/browser';
import { postAction } from '#lib/forms/action.js';
import { queryClient } from '#lib/query/context.js';
import type { PasskeyChallenge } from '@mesaaberta/core/server/auth/passkeys';

/**
 * Why a passkey attempt did not go through, for the words under the button: `cancelled` (the person
 * closed the prompt or took too long: no message), `unsupported` (this browser has no passkeys),
 * `refused` (Supabase did not accept the passkey), `exists` (that device already has one for this
 * account), `unavailable` (anything else).
 */
export type PasskeyProblem = 'cancelled' | 'unsupported' | 'refused' | 'exists' | 'unavailable';

type Step = { options: string; answer: string; fields?: Record<string, string> };

/**
 * One passkey ceremony, sign-in or adding one: asks the page's `options` action for a challenge,
 * runs the browser's passkey prompt and posts the answer to the `answer` action, whose result is
 * applied like any form's (a redirect goes there, a success reloads the page's data). Both posts go
 * through TanStack Query, like the app's other actions. Call it while the component initialises.
 */
export function passkeyCeremony(kind: 'sign-in' | 'register', step: Step) {
  const client = queryClient();
  let problem = $state<PasskeyProblem | null>(null);

  const mutation = createMutation(
    () => ({
      mutationFn: async (captcha: string | undefined): Promise<ActionResult | PasskeyProblem> => {
        if (!browserSupportsWebAuthn()) return 'unsupported';

        const ask = new FormData();
        if (captcha) ask.set('captchaToken', captcha);
        const offered = await postAction(step.options, ask);
        const challenge =
          offered.type === 'success'
            ? (offered.data?.challenge as PasskeyChallenge | undefined)
            : undefined;
        if (!challenge) return 'unavailable';

        let credential: unknown;
        try {
          credential =
            kind === 'sign-in'
              ? await startAuthentication({ optionsJSON: challenge.options as never })
              : await startRegistration({ optionsJSON: challenge.options as never });
        } catch (error) {
          return promptProblem(error);
        }

        const answer = new FormData();
        answer.set('challengeId', challenge.challengeId);
        answer.set('credential', JSON.stringify(credential));
        for (const [name, value] of Object.entries(step.fields ?? {})) answer.set(name, value);
        return postAction(step.answer, answer);
      },
      retry: false,
    }),
    () => client,
  );

  async function start(captcha?: string) {
    if (mutation.isPending) return;
    problem = null;
    try {
      const result = await mutation.mutateAsync(captcha);
      if (typeof result === 'string') {
        problem = result;
        return;
      }
      if (result.type === 'failure') {
        problem = result.data?.passkey === 'refused' ? 'refused' : 'unavailable';
        return;
      }
      if (result.type === 'error') {
        problem = 'unavailable';
        return;
      }
      await applyAction(result);
    } catch {
      problem = 'unavailable';
    }
  }

  return {
    start,
    get pending() {
      return mutation.isPending;
    },
    /** Shown under the button; `cancelled` shows nothing. */
    get problem() {
      return problem;
    },
  };
}

/** What the browser's prompt threw, as a problem. Closing it is not an error worth words. */
function promptProblem(error: unknown): PasskeyProblem {
  const name = error instanceof WebAuthnError ? error.code : (error as Error | null)?.name;
  if (name === 'ERROR_CEREMONY_ABORTED' || name === 'NotAllowedError' || name === 'AbortError')
    return 'cancelled';
  if (name === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED' || name === 'InvalidStateError')
    return 'exists';
  if (name === 'NotSupportedError') return 'unsupported';
  // A WebAuthnError keeps the browser's own error as its cause.
  const cause = (error as { cause?: Error } | null)?.cause?.name;
  if (cause === 'NotAllowedError' || cause === 'AbortError') return 'cancelled';
  return 'unavailable';
}
