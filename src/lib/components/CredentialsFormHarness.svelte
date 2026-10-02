<script lang="ts">
  import { actionForm } from '$lib/forms/action-form.svelte';
  import CredentialsForm from './CredentialsForm.svelte';
  import { credentialsSchema } from '$lib/auth/credentials';
  import type { FormMessage } from '$lib/forms/message';

  type Props = {
    mode: 'login' | 'signup';
    next?: string;
    email?: string;
    message?: FormMessage;
    errors?: { email?: string[]; password?: string[] };
    action?: string;
  };
  let { mode, next = '/', email = '', message, errors, action }: Props = $props();

  // svelte-ignore state_referenced_locally
  const controller = actionForm({
    initial: { email, password: '', next },
    schema: credentialsSchema,
    initialErrors: errors,
    initialMessage: message,
    onSuccess: () => {},
    errorMessage: () => 'failed',
  });
</script>

<CredentialsForm {mode} {controller} {action} />
