<script lang="ts">
	import type { SuperForm } from 'sveltekit-superforms';
	import FormField from './FormField.svelte';
	import type { FormMessage } from '$lib/forms/message';
	import { errorText, formProblem, type TableFormValues } from '$lib/tables/form-values';
	import { m } from '$lib/paraglide/messages';

	type Props = {
		superform: SuperForm<TableFormValues, FormMessage>;
		systems: { name: string; slug: string }[];
		submitLabel: string;
		imageUrl?: string | null;
		action?: string;
	};

	let { superform, systems, submitLabel, imageUrl = null, action }: Props = $props();
	const { form, errors, message, enhance, delayed } = superform;
	const timezones = Intl.supportedValuesOf('timeZone');
	const previewSystem = $derived(
		systems.find((system) => system.slug === $form.systemSlug)?.name ?? 'Sistema'
	);
	const err = (field: keyof TableFormValues) =>
		$errors[field]?.[0] ? errorText($errors[field][0], field) : undefined;
	const imageError = $derived(
		$message?.field === 'image' ? errorText($message.code, 'image') : undefined
	);
	const invalid = (field: keyof TableFormValues) => ($errors[field]?.[0] ? 'true' : undefined);
	const problem = $derived(formProblem($message));
	const hasErrors = $derived(
		Object.values($errors).some((list) => Array.isArray(list) && list.length > 0) || !!imageError
	);
</script>

<form
	method="POST"
	{action}
	enctype="multipart/form-data"
	use:enhance
	class="mt-8 grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]"
>
	<div class="grid gap-8">
		{#if hasErrors}<p role="alert" class="font-semibold text-error-700-300">
				{m.form_summary()}
			</p>{/if}
		{#if problem}<p role="alert" class="font-semibold text-error-700-300">{problem}</p>{/if}

		<section
			aria-labelledby="about-table"
			class="card border border-surface-200-800 bg-surface-100-900 p-5 sm:p-7"
		>
			<div class="mb-6 flex items-baseline gap-3">
				<span class="text-2xl font-semibold text-warning-700-300" aria-hidden="true">1</span>
				<h2 id="about-table" class="text-2xl font-semibold">Sobre a mesa</h2>
			</div>
			<div class="grid gap-6">
				<FormField id="systemSlug" label={m.form_system()} error={err('systemSlug')}>
					<select
						id="systemSlug"
						name="systemSlug"
						required
						bind:value={$form.systemSlug}
						class="select"
						aria-invalid={invalid('systemSlug')}
						><option value="">{m.form_system_choose()}</option
						>{#each systems as system (system.slug)}<option value={system.slug}
								>{system.name}</option
							>{/each}</select
					>
				</FormField>
				<FormField id="title" label={m.form_title()} error={err('title')}>
					<input
						id="title"
						name="title"
						required
						minlength="3"
						maxlength="80"
						bind:value={$form.title}
						class="input"
						aria-invalid={invalid('title')}
					/>
				</FormField>
				<FormField id="description" label={m.form_description()} error={err('description')}>
					<textarea
						id="description"
						name="description"
						rows="5"
						maxlength="4000"
						bind:value={$form.description}
						class="textarea"
						aria-invalid={invalid('description')}></textarea>
				</FormField>
				<FormField
					id="extraInfo"
					label={m.form_extra_info()}
					hint={m.form_extra_info_hint()}
					error={err('extraInfo')}
				>
					<textarea
						id="extraInfo"
						name="extraInfo"
						rows="3"
						maxlength="2000"
						bind:value={$form.extraInfo}
						class="textarea"
						aria-invalid={invalid('extraInfo')}></textarea>
				</FormField>
				<FormField
					id="welcomeMessage"
					label={m.form_welcome_message()}
					hint={m.form_welcome_message_hint({ token: '{nome da mesa}' })}
					error={err('welcomeMessage')}
				>
					<textarea
						id="welcomeMessage"
						name="welcomeMessage"
						rows="4"
						maxlength="1000"
						bind:value={$form.welcomeMessage}
						class="textarea"
						aria-invalid={invalid('welcomeMessage')}></textarea>
				</FormField>
				<fieldset class="grid gap-2">
					<legend class="font-semibold">{m.form_kind()}</legend>
					{#each [['one_shot', m.form_kind_one_shot()], ['campaign', m.form_kind_campaign()]] as [value, label] (value)}<label
							class="flex items-center gap-2"
							><input type="radio" name="kind" {value} bind:group={$form.kind} />{label}</label
						>{/each}
					{#if $errors.kind}<p role="alert" class="text-sm font-semibold text-error-700-300">
							{err('kind')}
						</p>{/if}
				</fieldset>
			</div>
		</section>

		<section
			aria-labelledby="when"
			class="card border border-surface-200-800 bg-surface-100-900 p-5 sm:p-7"
		>
			<div class="mb-6 flex items-baseline gap-3">
				<span class="text-2xl font-semibold text-warning-700-300" aria-hidden="true">2</span>
				<h2 id="when" class="text-2xl font-semibold">Quando</h2>
			</div>
			<div class="grid gap-6 sm:grid-cols-2">
				<FormField id="startsAtLocal" label={m.form_starts_at()} error={err('startsAtLocal')}
					><input
						id="startsAtLocal"
						name="startsAtLocal"
						type="datetime-local"
						required
						bind:value={$form.startsAtLocal}
						class="input"
						aria-invalid={invalid('startsAtLocal')}
					/></FormField
				>
				<FormField id="timezone" label={m.form_timezone()} error={err('timezone')}
					><select
						id="timezone"
						name="timezone"
						required
						bind:value={$form.timezone}
						class="select"
						aria-invalid={invalid('timezone')}
						>{#each timezones as zone (zone)}<option value={zone}>{zone}</option>{/each}</select
					></FormField
				>
				<FormField id="durationMinutes" label={m.form_duration()} error={err('durationMinutes')}
					><input
						id="durationMinutes"
						name="durationMinutes"
						type="number"
						required
						min="15"
						max="1440"
						step="5"
						bind:value={$form.durationMinutes}
						class="input"
						aria-invalid={invalid('durationMinutes')}
					/></FormField
				>
			</div>
			{#if $form.kind === 'campaign'}
				<div class="grid gap-6 sm:grid-cols-2">
					<FormField id="repeat" label={m.form_repeat()} error={err('repeat')}
						><select
							id="repeat"
							name="repeat"
							bind:value={$form.repeat}
							class="select"
							aria-invalid={invalid('repeat')}
							><option value="weekly">{m.form_repeat_weekly()}</option><option value="biweekly"
								>{m.form_repeat_biweekly()}</option
							></select
						></FormField
					>
					<FormField
						id="until"
						label={m.form_until()}
						hint={m.form_until_hint()}
						error={err('until')}
						><input
							id="until"
							name="until"
							type="date"
							bind:value={$form.until}
							class="input"
							aria-invalid={invalid('until')}
						/></FormField
					>
				</div>
			{/if}
		</section>

		<section
			aria-labelledby="seats-entry"
			class="card border border-surface-200-800 bg-surface-100-900 p-5 sm:p-7"
		>
			<div class="mb-6 flex items-baseline gap-3">
				<span class="text-2xl font-semibold text-warning-700-300" aria-hidden="true">3</span>
				<h2 id="seats-entry" class="text-2xl font-semibold">Vagas e entrada</h2>
			</div>
			<FormField id="capacity" label={m.form_capacity()} error={err('capacity')}
				><input
					id="capacity"
					name="capacity"
					type="number"
					required
					min="1"
					max="30"
					bind:value={$form.capacity}
					class="input"
					aria-invalid={invalid('capacity')}
				/></FormField
			>
			<fieldset class="grid gap-2">
				<legend class="font-semibold">{m.form_join_mode()}</legend
				>{#each [['auto', m.form_join_auto()], ['approval', m.form_join_approval()]] as [value, label] (value)}<label
						class="flex items-center gap-2"
						><input
							type="radio"
							name="joinMode"
							{value}
							bind:group={$form.joinMode}
						/>{label}</label
					>{/each}
			</fieldset>
		</section>

		<section
			aria-labelledby="image-section"
			class="card border border-surface-200-800 bg-surface-100-900 p-5 sm:p-7"
		>
			<div class="mb-6 flex items-baseline gap-3">
				<span class="text-2xl font-semibold text-warning-700-300" aria-hidden="true">4</span>
				<h2 id="image-section" class="text-2xl font-semibold">Imagem</h2>
			</div>
			<FormField
				id="image"
				label={m.form_image()}
				hint={imageUrl ? m.form_image_current() : m.form_image_hint()}
				error={imageError}
			>
				{#if imageUrl}<img src={imageUrl} alt="" class="mb-2 h-24 rounded" />{/if}
				<input
					id="image"
					name="image"
					type="file"
					accept="image/png,image/jpeg,image/webp"
					class="input"
					aria-invalid={imageError ? 'true' : undefined}
				/>
			</FormField>
		</section>
		<div>
			<button type="submit" class="btn preset-filled-primary-500" aria-busy={$delayed}
				>{submitLabel}</button
			>
		</div>
	</div>
	<aside class="lg:pt-0">
		<div class="card preset-filled-primary-500 p-5 lg:sticky lg:top-6">
			<p class="text-sm font-semibold tracking-wide">Prévia da mesa</p>
			<div class="mt-5 rounded-2xl bg-surface-950/10 p-4">
				<p class="text-sm opacity-90">{previewSystem}</p>
				<p class="mt-2 text-2xl font-semibold">{$form.title || 'Título da sua mesa'}</p>
				<p class="mt-5 text-sm opacity-90">
					{$form.kind === 'campaign' ? m.table_kind_campaign() : m.table_kind_one_shot()} · {$form.capacity ||
						'0'} vagas
				</p>
			</div>
			<p class="mt-4 text-sm opacity-90">A prévia acompanha título, sistema, tipo e vagas.</p>
		</div>
	</aside>
</form>
