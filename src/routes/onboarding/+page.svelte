<script lang="ts">
  import AuthShell from '$lib/components/AuthShell.svelte';
  import ProfileForm from '$lib/components/ProfileForm.svelte';
  import { m } from '$lib/paraglide/messages';

  let { data, form = null } = $props();
</script>

<svelte:head>
  <title>{m.profile_title()}</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<!-- The last step of signing up, in the same frame as the sign-in pages. -->
<AuthShell title={m.profile_title()} lede={m.profile_lede()}>
  <ProfileForm form={form?.form ?? data.form} />
</AuthShell>
