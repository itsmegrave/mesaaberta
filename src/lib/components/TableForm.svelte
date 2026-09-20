<script lang="ts">
	import FormField from './FormField.svelte';
	import { errorText, type FormValues } from '$lib/tables/form-values';
	import { m } from '$lib/paraglide/messages';

	type Props = {
		values: FormValues;
		errors?: Record<string, string>;
		systems: { name: string; slug: string }[];
		submitLabel: string;
		imageUrl?: string | null;
		/** Where to post, when not the page's own default action (e.g. `?/save`). */
		action?: string;
	};

	let { values, errors = {}, systems, submitLabel, imageUrl = null, action }: Props = $props();

	// Only a campaign repeats. Without JavaScript both stay visible and the server ignores them for a one-shot.
	// The form is posted as a whole page load, so `values` does not change under a mounted form.
	// svelte-ignore state_referenced_locally
	let kind = $state(values.kind);
	const timezones = Intl.supportedValuesOf('timeZone');

	const input = 'block w-full rounded border border-petrol/30 bg-surface px-3 py-2';
	const err = (field: string) => (errors[field] ? errorText(errors[field], field) : undefined);
	const invalid = (field: string) => (errors[field] ? 'true' : undefined);
</script>

<form method="POST" {action} enctype="multipart/form-data" class="mt-8 grid max-w-2xl gap-6">
	{#if Object.keys(errors).length > 0}
		<p role="alert" class="font-semibold text-danger">{m.form_summary()}</p>
	{/if}

	<FormField id="systemSlug" label={m.form_system()} error={err('systemSlug')}>
		<select
			id="systemSlug"
			name="systemSlug"
			required
			class={input}
			aria-invalid={invalid('systemSlug')}
		>
			<option value="">{m.form_system_choose()}</option>
			{#each systems as system (system.slug)}
				<option value={system.slug} selected={system.slug === values.systemSlug}
					>{system.name}</option
				>
			{/each}
		</select>
	</FormField>

	<FormField id="title" label={m.form_title()} error={err('title')}>
		<input
			id="title"
			name="title"
			required
			minlength="3"
			maxlength="80"
			value={values.title}
			class={input}
			aria-invalid={invalid('title')}
		/>
	</FormField>

	<FormField id="description" label={m.form_description()} error={err('description')}>
		<textarea
			id="description"
			name="description"
			rows="5"
			maxlength="4000"
			class={input}
			aria-invalid={invalid('description')}>{values.description}</textarea
		>
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
			class={input}
			aria-invalid={invalid('extraInfo')}>{values.extraInfo}</textarea
		>
	</FormField>

	<fieldset class="grid gap-2">
		<legend class="font-semibold">{m.form_kind()}</legend>
		{#each [['one_shot', m.form_kind_one_shot()], ['campaign', m.form_kind_campaign()]] as [value, label] (value)}
			<label class="flex items-center gap-2">
				<input type="radio" name="kind" {value} bind:group={kind} />
				{label}
			</label>
		{/each}
		{#if errors.kind}<p role="alert" class="text-sm font-semibold text-danger">
				{err('kind')}
			</p>{/if}
	</fieldset>

	<div class="grid gap-6 sm:grid-cols-2">
		<FormField id="startsAtLocal" label={m.form_starts_at()} error={err('startsAtLocal')}>
			<input
				id="startsAtLocal"
				name="startsAtLocal"
				type="datetime-local"
				required
				value={values.startsAtLocal}
				class={input}
				aria-invalid={invalid('startsAtLocal')}
			/>
		</FormField>

		<FormField id="timezone" label={m.form_timezone()} error={err('timezone')}>
			<select
				id="timezone"
				name="timezone"
				required
				class={input}
				aria-invalid={invalid('timezone')}
			>
				{#each timezones as zone (zone)}
					<option value={zone} selected={zone === values.timezone}>{zone}</option>
				{/each}
			</select>
		</FormField>

		<FormField id="durationMinutes" label={m.form_duration()} error={err('durationMinutes')}>
			<input
				id="durationMinutes"
				name="durationMinutes"
				type="number"
				required
				min="15"
				max="1440"
				step="5"
				value={values.durationMinutes}
				class={input}
				aria-invalid={invalid('durationMinutes')}
			/>
		</FormField>

		<FormField id="capacity" label={m.form_capacity()} error={err('capacity')}>
			<input
				id="capacity"
				name="capacity"
				type="number"
				required
				min="1"
				max="30"
				value={values.capacity}
				class={input}
				aria-invalid={invalid('capacity')}
			/>
		</FormField>
	</div>

	{#if kind === 'campaign'}
		<div class="grid gap-6 sm:grid-cols-2">
			<FormField id="repeat" label={m.form_repeat()} error={err('repeat')}>
				<select id="repeat" name="repeat" class={input} aria-invalid={invalid('repeat')}>
					<option value="weekly" selected={values.repeat !== 'biweekly'}
						>{m.form_repeat_weekly()}</option
					>
					<option value="biweekly" selected={values.repeat === 'biweekly'}
						>{m.form_repeat_biweekly()}</option
					>
				</select>
			</FormField>

			<FormField id="until" label={m.form_until()} hint={m.form_until_hint()} error={err('until')}>
				<input
					id="until"
					name="until"
					type="date"
					value={values.until}
					class={input}
					aria-invalid={invalid('until')}
				/>
			</FormField>
		</div>
	{/if}

	<fieldset class="grid gap-2">
		<legend class="font-semibold">{m.form_join_mode()}</legend>
		{#each [['auto', m.form_join_auto()], ['approval', m.form_join_approval()]] as [value, label] (value)}
			<label class="flex items-center gap-2">
				<input type="radio" name="joinMode" {value} checked={values.joinMode === value} />
				{label}
			</label>
		{/each}
	</fieldset>

	<FormField
		id="image"
		label={m.form_image()}
		hint={imageUrl ? m.form_image_current() : m.form_image_hint()}
		error={err('image')}
	>
		{#if imageUrl}<img src={imageUrl} alt="" class="mb-2 h-24 rounded" />{/if}
		<input
			id="image"
			name="image"
			type="file"
			accept="image/png,image/jpeg,image/webp"
			class={input}
			aria-invalid={invalid('image')}
		/>
	</FormField>

	<div>
		<button type="submit" class="rounded bg-petrol px-5 py-3 font-semibold text-on-petrol"
			>{submitLabel}</button
		>
	</div>
</form>
