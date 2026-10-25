<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';
  import type { IconName } from '#lib/icons/names.js';
  import PostButton from '#lib/components/PostButton.svelte';
  import type { FormMessage } from '#lib/forms/message.js';
  import { actionSchema } from '#lib/tables/registration.js';
  import { registrationError } from '#lib/tables/registration-errors.js';
  import { toast } from '#lib/toaster.js';

  type Props = {
    /** Where to post: `?/leave` on the table's own page, or the table's address plus `?/leave` from elsewhere. */
    action: string;
    playerId?: string;
    next?: string;
    class?: string;
    /** The button's text. With it, the form draws its own `SubmitButton`, busy while it posts. */
    label?: string;
    /** An icon before `label`. */
    icon?: IconName;
    buttonClass?: string;
    /** Shown as a toast when the action went through. */
    success?: string;
    /** Runs when the action went through (the server answered with a redirect back to the page). */
    onsuccess?: () => void;
    /** Runs when the server refused, after the error is shown as a toast. */
    onfail?: (message: FormMessage) => void;
    /** Custom content instead of `label` (a button of its own must be `type="submit"`). */
    children?: Snippet;
  };

  let {
    action,
    playerId,
    next = '',
    class: className = '',
    label,
    icon,
    buttonClass = '',
    success,
    onsuccess,
    onfail,
    children,
  }: Props = $props();
</script>

<PostButton
  {action}
  fields={{ playerId, next }}
  schema={actionSchema}
  domain={action.includes('Photo') ? 'account' : 'table'}
  errorMessage={() => registrationError('invalid')}
  {success}
  onSuccess={() => onsuccess?.()}
  onFailure={(updated) => {
    const message = updated?.message ?? { code: 'invalid' };
    toast.error(registrationError(message.code, message.retryAfter));
    onfail?.(message);
  }}
  class={className}
  {buttonClass}
  content={label ? undefined : (children ?? nothing)}
  >{#if icon}<Icon name={icon} size={20} />{/if}{label}</PostButton
>

{#snippet nothing()}{/snippet}
