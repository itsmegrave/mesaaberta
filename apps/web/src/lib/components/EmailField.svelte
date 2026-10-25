<script lang="ts">
  import AuthField from '#lib/components/AuthField.svelte';
  import { m } from '#lib/paraglide/messages.js';

  // The e-mail of the sign-in, sign-up and recovery forms.
  let { value = $bindable(''), error }: { value?: string; error?: string } = $props();
</script>

<AuthField
  id="email"
  name="email"
  label={m.auth_email()}
  {error}
  type="email"
  required
  autocomplete="email"
  bind:value
/>
