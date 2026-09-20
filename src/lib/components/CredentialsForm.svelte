<script lang="ts">
	import FormField from './FormField.svelte';
	import { m } from '$lib/paraglide/messages';

	type Props = {
		mode: 'login' | 'signup';
		next: string;
		email?: string;
		/** Field errors from the validation: a short code per field. */
		errors?: { email?: string; password?: string };
		/** What Supabase said, as a code from the server. */
		result?: string;
		action?: string;
	};

	let { mode, next, email = '', errors = {}, result, action }: Props = $props();

	const input = 'block w-full rounded border border-ink/60 bg-surface px-3 py-2';
	const messages: Record<string, () => string> = {
		invalid: m.auth_error_invalid,
		unconfirmed: m.auth_error_unconfirmed,
		weak_password: m.auth_error_weak,
		rate_limited: m.auth_error_rate_limited,
		failed: m.auth_error_failed
	};
</script>

<form method="POST" {action} class="grid max-w-sm gap-5">
	{#if result && messages[result]}
		<p role="alert" class="font-semibold text-danger">{messages[result]()}</p>
	{/if}

	<input type="hidden" name="next" value={next} />

	<FormField
		id="email"
		label={m.auth_email()}
		error={errors.email ? m.auth_error_email() : undefined}
	>
		<input
			id="email"
			name="email"
			type="email"
			required
			autocomplete="email"
			value={email}
			class={input}
			aria-invalid={errors.email ? 'true' : undefined}
		/>
	</FormField>

	<FormField
		id="password"
		label={m.auth_password()}
		hint={mode === 'signup' ? m.auth_password_hint() : undefined}
		error={errors.password ? m.auth_error_password() : undefined}
	>
		<input
			id="password"
			name="password"
			type="password"
			required
			minlength="8"
			maxlength="72"
			autocomplete={mode === 'signup' ? 'new-password' : 'current-password'}
			class={input}
			aria-invalid={errors.password ? 'true' : undefined}
		/>
	</FormField>

	<div>
		<button type="submit" class="w-full rounded bg-petrol px-5 py-3 font-semibold text-on-petrol">
			{mode === 'signup' ? m.signup_submit() : m.login_submit()}
		</button>
	</div>
</form>
