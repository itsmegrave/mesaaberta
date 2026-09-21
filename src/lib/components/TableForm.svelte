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
	// svelte-ignore state_referenced_locally
	let title = $state(values.title);
	// svelte-ignore state_referenced_locally
	let systemSlug = $state(values.systemSlug);
	// svelte-ignore state_referenced_locally
	let capacity = $state(values.capacity);
	const timezones = Intl.supportedValuesOf('timeZone');
	const previewSystem = $derived(
		systems.find((system) => system.slug === systemSlug)?.name ?? 'Sistema'
	);

	const input = 'block w-full rounded border border-ink/60 bg-surface px-3 py-2';
	const err = (field: string) => (errors[field] ? errorText(errors[field], field) : undefined);
	const invalid = (field: string) => (errors[field] ? 'true' : undefined);
</script>

<form
	method="POST"
	{action}
	enctype="multipart/form-data"
	class="mt-8 grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]"
>
	<div class="grid gap-8">
		{#if Object.keys(errors).length > 0}
			<p role="alert" class="font-semibold text-danger">{m.form_summary()}</p>
		{/if}

		<section
			aria-labelledby="about-table"
			class="rounded-[24px] border border-line bg-surface p-5 sm:p-7"
		>
			<div class="mb-6 flex items-baseline gap-3">
				<span class="font-display text-2xl font-semibold text-lamp" aria-hidden="true">1</span>
				<h2 id="about-table" class="text-2xl font-semibold">Sobre a mesa</h2>
			</div>
			<div class="grid gap-6">
				<FormField id="systemSlug" label={m.form_system()} error={err('systemSlug')}>
					<select
						id="systemSlug"
						name="systemSlug"
						required
						bind:value={systemSlug}
						class={input}
						aria-invalid={invalid('systemSlug')}
					>
						<option value="">{m.form_system_choose()}</option>
						{#each systems as system (system.slug)}
							<option value={system.slug}>{system.name}</option>
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
						bind:value={title}
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
			</div>
		</section>

		<section aria-labelledby="when" class="rounded-[24px] border border-line bg-surface p-5 sm:p-7">
			<div class="mb-6 flex items-baseline gap-3">
				<span class="font-display text-2xl font-semibold text-lamp" aria-hidden="true">2</span>
				<h2 id="when" class="text-2xl font-semibold">Quando</h2>
			</div>
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

					<FormField
						id="until"
						label={m.form_until()}
						hint={m.form_until_hint()}
						error={err('until')}
					>
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
		</section>

		<section
			aria-labelledby="seats-entry"
			class="rounded-[24px] border border-line bg-surface p-5 sm:p-7"
		>
			<div class="mb-6 flex items-baseline gap-3">
				<span class="font-display text-2xl font-semibold text-lamp" aria-hidden="true">3</span>
				<h2 id="seats-entry" class="text-2xl font-semibold">Vagas e entrada</h2>
			</div>
			<FormField id="capacity" label={m.form_capacity()} error={err('capacity')}>
				<input
					id="capacity"
					name="capacity"
					type="number"
					required
					min="1"
					max="30"
					bind:value={capacity}
					class={input}
					aria-invalid={invalid('capacity')}
				/>
			</FormField>
			<fieldset class="grid gap-2">
				<legend class="font-semibold">{m.form_join_mode()}</legend>
				{#each [['auto', m.form_join_auto()], ['approval', m.form_join_approval()]] as [value, label] (value)}
					<label class="flex items-center gap-2">
						<input type="radio" name="joinMode" {value} checked={values.joinMode === value} />
						{label}
					</label>
				{/each}
			</fieldset>
		</section>

		<section
			aria-labelledby="image-section"
			class="rounded-[24px] border border-line bg-surface p-5 sm:p-7"
		>
			<div class="mb-6 flex items-baseline gap-3">
				<span class="font-display text-2xl font-semibold text-lamp" aria-hidden="true">4</span>
				<h2 id="image-section" class="text-2xl font-semibold">Imagem</h2>
			</div>
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
		</section>

		<div>
			<button type="submit" class="rounded bg-petrol px-5 py-3 font-semibold text-on-petrol"
				>{submitLabel}</button
			>
		</div>
	</div>

	<aside class="lg:pt-0">
		<div class="rounded-[24px] border border-line bg-petrol p-5 text-on-petrol lg:sticky lg:top-6">
			<p class="font-display text-sm font-semibold tracking-wide">Prévia da mesa</p>
			<div class="mt-5 rounded-2xl bg-white/10 p-4">
				<p class="text-sm font-semibold text-on-petrol/80">{previewSystem}</p>
				<p class="mt-2 text-2xl font-semibold">{title || 'Título da sua mesa'}</p>
				<p class="mt-5 text-sm text-on-petrol/85">
					{kind === 'campaign' ? m.table_kind_campaign() : m.table_kind_one_shot()} · {capacity ||
						'0'} vagas
				</p>
			</div>
			<p class="mt-4 text-sm text-on-petrol/80">
				A prévia acompanha título, sistema, tipo e vagas.
			</p>
		</div>
	</aside>
</form>
