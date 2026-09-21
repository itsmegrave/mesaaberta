<script lang="ts">
	import { defaults, superForm } from 'sveltekit-superforms';
	import { zod4, zod4Client } from 'sveltekit-superforms/adapters';
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
	const superform = superForm(defaults({ email, password: '', next }, zod4(credentialsSchema)), {
		validators: zod4Client(credentialsSchema)
	});
	// svelte-ignore state_referenced_locally
	if (message) superform.message.set(message);
	// svelte-ignore state_referenced_locally
	if (errors) superform.errors.set(errors);
</script>

<CredentialsForm {mode} {superform} {action} />
