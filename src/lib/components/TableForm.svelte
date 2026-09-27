<script lang="ts">
	import type { SuperForm } from 'sveltekit-superforms';
	import FormField from './FormField.svelte';
	import type { FormMessage } from '$lib/forms/message';
	import { errorText, formProblem, type TableFormValues } from '$lib/tables/form-values';
	import { m } from '$lib/paraglide/messages';
	import { formatDuration, zonedToDate } from '$lib/tables/format';
	import TableCard from './TableCard.svelte';

	type Props = {
		superform: SuperForm<TableFormValues, FormMessage>;
		systems: { name: string; slug: string }[];
		submitLabel: string;
		imageUrl?: string | null;
		action?: string;
		/** Where "Cancelar" goes: the list for a new table, the table itself when editing. */
		cancelHref?: string;
		/** Shown as the GM on the preview card. */
		gmName?: string;
	};

	let {
		superform,
		systems,
		submitLabel,
		imageUrl = null,
		action,
		cancelHref = '/tables',
		gmName = 'jogador'
	}: Props = $props();
	const { form, errors, message, enhance, delayed } = superform;
	const timezones = Intl.supportedValuesOf('timeZone');
	const previewSystem = $derived(
		systems.find((system) => system.slug === $form.systemSlug)?.name ?? m.form_system()
	);
	// The card the list will show, from what is typed so far.
	const preview = $derived({
		slug: 'preview',
		title: $form.title || m.form_preview_title(),
		kind: $form.kind,
		system: { name: previewSystem },
		gmName,
		capacity: Number($form.capacity) || 1,
		seatsLeft: Number($form.capacity) || 1,
		timezone: $form.timezone,
		nextAt: zonedToDate($form.startsAtLocal, $form.timezone),
		imageUrl,
		modality: $form.modality,
		locationArea: $form.locationArea || null
	});
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
	class="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12"
>
	<div class="grid gap-8">
		{#if hasErrors}<p role="alert" class="font-semibold text-error-700-300">
				{m.form_summary()}
			</p>{/if}
		{#if problem}<p role="alert" class="font-semibold text-error-700-300">{problem}</p>{/if}

		<section
			aria-labelledby="about-table"
			class="rounded-lg border border-surface-200-800 bg-panel p-6 sm:p-8"
		>
			<div class="mb-6 flex items-center gap-3">
				<span
					class="flex size-8 shrink-0 items-center justify-center rounded-full preset-filled-primary-500 text-base font-bold"
					aria-hidden="true">1</span
				>
				<h2 id="about-table" class="text-[26px] font-semibold tracking-[-0.02em]">Sobre a mesa</h2>
			</div>
			<div class="grid gap-6">
				<FormField id="systemSlug" label={m.form_system()} error={err('systemSlug')}>
					<select
						id="systemSlug"
						name="systemSlug"
						required
						bind:value={$form.systemSlug}
						class="select h-12 rounded-lg border-surface-200-800 bg-panel px-3"
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
						class="input h-12 rounded-lg border-surface-200-800 bg-panel px-3"
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
						class="textarea rounded-lg border-surface-200-800 bg-panel p-3"
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
						class="textarea rounded-lg border-surface-200-800 bg-panel p-3"
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
						class="textarea rounded-lg border-surface-200-800 bg-panel p-3"
						aria-invalid={invalid('welcomeMessage')}></textarea>
				</FormField>
			</div>
		</section>

		<section
			aria-labelledby="when"
			class="grid gap-6 rounded-lg border border-surface-200-800 bg-panel p-6 sm:p-8"
		>
			<div class="flex items-center gap-3">
				<span
					class="flex size-8 shrink-0 items-center justify-center rounded-full preset-filled-primary-500 text-base font-bold"
					aria-hidden="true">2</span
				>
				<h2 id="when" class="text-[26px] font-semibold tracking-[-0.02em]">Quando</h2>
			</div>
			<fieldset class="grid gap-3 sm:grid-cols-2">
				<legend class="mb-2 font-semibold sm:col-span-2">{m.form_kind()}</legend>
				{#each [['one_shot', m.form_kind_one_shot()], ['campaign', m.form_kind_campaign()]] as [value, label] (value)}<label
						class="flex cursor-pointer items-center gap-3 rounded-lg border-[1.5px] border-surface-200-800 p-4 font-semibold has-[:checked]:border-primary-500 has-[:checked]:bg-primary-500/8"
						><input type="radio" name="kind" {value} bind:group={$form.kind} />{label}</label
					>{/each}
				{#if $errors.kind}<p role="alert" class="text-sm font-semibold text-error-700-300">
						{err('kind')}
					</p>{/if}
			</fieldset>
			<div class="grid gap-6 sm:grid-cols-2">
				<FormField id="startsAtLocal" label={m.form_starts_at()} error={err('startsAtLocal')}
					><input
						id="startsAtLocal"
						name="startsAtLocal"
						type="datetime-local"
						required
						bind:value={$form.startsAtLocal}
						class="input h-12 rounded-lg border-surface-200-800 bg-panel px-3"
						aria-invalid={invalid('startsAtLocal')}
					/></FormField
				>
				<FormField id="timezone" label={m.form_timezone()} error={err('timezone')}
					><select
						id="timezone"
						name="timezone"
						required
						bind:value={$form.timezone}
						class="select h-12 rounded-lg border-surface-200-800 bg-panel px-3"
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
						class="input h-12 rounded-lg border-surface-200-800 bg-panel px-3"
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
							class="select h-12 rounded-lg border-surface-200-800 bg-panel px-3"
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
							class="input h-12 rounded-lg border-surface-200-800 bg-panel px-3"
							aria-invalid={invalid('until')}
						/></FormField
					>
				</div>
			{/if}
		</section>

		<section
			aria-labelledby="seats-entry"
			class="grid gap-6 rounded-lg border border-surface-200-800 bg-panel p-6 sm:p-8"
		>
			<div class="flex items-center gap-3">
				<span
					class="flex size-8 shrink-0 items-center justify-center rounded-full preset-filled-primary-500 text-base font-bold"
					aria-hidden="true">3</span
				>
				<h2 id="seats-entry" class="text-[26px] font-semibold tracking-[-0.02em]">
					Vagas e entrada
				</h2>
			</div>
			<fieldset class="grid gap-3 sm:grid-cols-2">
				<legend class="mb-2 font-semibold sm:col-span-2">{m.form_modality()}</legend
				>{#each [['online', m.table_modality_online()], ['in_person', m.table_modality_in_person()]] as [value, label] (value)}<label
						class="flex cursor-pointer items-center gap-3 rounded-lg border-[1.5px] border-surface-200-800 p-4 font-semibold has-[:checked]:border-primary-500 has-[:checked]:bg-primary-500/8"
						><input
							type="radio"
							name="modality"
							{value}
							bind:group={$form.modality}
						/>{label}</label
					>{/each}
			</fieldset>
			{#if $form.modality === 'in_person'}
				<FormField
					id="postalCode"
					label={m.form_postal_code()}
					hint={m.form_postal_code_hint()}
					error={err('postalCode')}
					><input
						id="postalCode"
						name="postalCode"
						inputmode="numeric"
						autocomplete="postal-code"
						maxlength="10"
						placeholder="00000-000"
						bind:value={$form.postalCode}
						class="input h-12 max-w-48 rounded-lg border-surface-200-800 bg-panel px-3"
						aria-invalid={invalid('postalCode')}
					/></FormField
				>
				<FormField
					id="locationArea"
					label={m.form_location_area()}
					hint={$form.postalCode ? m.form_location_area_hint_cep() : m.form_location_area_hint()}
					error={err('locationArea')}
					><input
						id="locationArea"
						name="locationArea"
						maxlength="120"
						autocomplete="off"
						bind:value={$form.locationArea}
						class="input h-12 rounded-lg border-surface-200-800 bg-panel px-3"
						aria-invalid={invalid('locationArea')}
					/></FormField
				>
			{/if}
			<FormField
				id="joinDetails"
				label={$form.modality === 'in_person'
					? m.form_join_details_place()
					: m.form_join_details_link()}
				hint={m.form_join_details_hint()}
				error={err('joinDetails')}
				><textarea
					id="joinDetails"
					name="joinDetails"
					rows="3"
					maxlength="1000"
					bind:value={$form.joinDetails}
					class="textarea rounded-lg border-surface-200-800 bg-panel p-3"
					aria-invalid={invalid('joinDetails')}></textarea></FormField
			>
			<FormField id="capacity" label={m.form_capacity()} error={err('capacity')}
				><input
					id="capacity"
					name="capacity"
					type="number"
					required
					min="1"
					max="30"
					bind:value={$form.capacity}
					class="input h-12 rounded-lg border-surface-200-800 bg-panel px-3"
					aria-invalid={invalid('capacity')}
				/></FormField
			>
			<fieldset class="grid gap-3 sm:grid-cols-2">
				<legend class="mb-2 font-semibold sm:col-span-2">{m.form_join_mode()}</legend
				>{#each [['auto', m.form_join_auto()], ['approval', m.form_join_approval()]] as [value, label] (value)}<label
						class="flex cursor-pointer items-center gap-3 rounded-lg border-[1.5px] border-surface-200-800 p-4 font-semibold has-[:checked]:border-primary-500 has-[:checked]:bg-primary-500/8"
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
			class="rounded-lg border border-surface-200-800 bg-panel p-6 sm:p-8"
		>
			<div class="mb-6 flex items-center gap-3">
				<span
					class="flex size-8 shrink-0 items-center justify-center rounded-full preset-filled-primary-500 text-base font-bold"
					aria-hidden="true">4</span
				>
				<h2 id="image-section" class="text-[26px] font-semibold tracking-[-0.02em]">Imagem</h2>
			</div>
			<div
				class="rounded-lg border-[1.5px] border-dashed border-surface-400-600 bg-surface-950/4 p-5 dark:bg-surface-50/4"
			>
				<FormField
					id="image"
					label={m.form_image()}
					hint={imageUrl ? m.form_image_current() : m.form_image_hint()}
					error={imageError}
				>
					{#if imageUrl}<img
							src={imageUrl}
							alt=""
							class="mb-3 aspect-[736/300] w-full max-w-sm rounded-lg object-cover"
						/>{/if}
					<input
						id="image"
						name="image"
						type="file"
						accept="image/png,image/jpeg,image/webp"
						class="block w-full text-sm file:mr-3 file:h-11 file:rounded-lg file:border-[1.5px] file:border-surface-950-50 file:bg-transparent file:px-4 file:font-semibold"
						aria-invalid={imageError ? 'true' : undefined}
					/>
				</FormField>
			</div>
		</section>
		<div class="flex flex-wrap items-center gap-5">
			<button
				type="submit"
				class="btn h-[52px] rounded-lg preset-filled-primary-500 px-7 font-semibold"
				aria-busy={$delayed}>{submitLabel}</button
			>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the caller passes a resolved href -->
			<a href={cancelHref} class="link-underline font-semibold text-link">{m.form_cancel()}</a>
		</div>
	</div>
	<aside aria-labelledby="preview-title" class="lg:sticky lg:top-6 lg:self-start">
		<p id="preview-title" class="text-sm font-bold tracking-[0.06em] text-muted uppercase">
			{m.form_preview()}
		</p>
		<!-- A preview, not a link: `inert` keeps its card out of the tab order and the reading order. -->
		<div class="mt-3" inert>
			<TableCard table={preview} />
		</div>
		<ul class="mt-4 grid gap-2 rounded-lg border border-surface-200-800 bg-panel p-5 text-[15px]">
			<li>
				{$form.modality === 'in_person'
					? `${m.table_modality_in_person()}${$form.locationArea ? ` · ${$form.locationArea}` : ''}`
					: m.table_modality_online()}
			</li>
			<li>
				{$form.kind === 'campaign'
					? $form.repeat === 'biweekly'
						? m.form_repeat_biweekly()
						: m.form_repeat_weekly()
					: m.table_recurrence_once()}, {formatDuration(Number($form.durationMinutes) || 0)}
			</li>
			<li>{$form.joinMode === 'approval' ? m.table_join_approval() : m.table_join_auto()}</li>
		</ul>
	</aside>
</form>
