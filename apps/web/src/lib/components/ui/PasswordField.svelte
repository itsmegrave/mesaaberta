<script lang="ts">
  import AuthField from '#lib/components/ui/AuthField.svelte';

  // A password: 8 to 72 characters (Supabase's limits), checked by the browser as by the server.
  // `autocomplete` tells a password manager whether to fill a saved one or offer a new one.
  let {
    id,
    name,
    label,
    hint,
    error,
    autocomplete,
    value = $bindable(''),
  }: {
    id: string;
    name: string;
    label: string;
    hint?: string;
    error?: string;
    autocomplete: 'current-password' | 'new-password';
    value?: string;
  } = $props();
</script>

<AuthField
  {id}
  {name}
  {label}
  {hint}
  {error}
  type="password"
  required
  minlength={8}
  maxlength={72}
  {autocomplete}
  bind:value
/>
