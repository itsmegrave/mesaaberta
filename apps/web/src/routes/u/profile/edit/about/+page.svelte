<script lang="ts">
  // "Sobre você": age range, gender, city and timezone, in a form of their own.
  import ProfileForm from '../../components/ProfileForm.svelte';
  import SettingsSection from '../components/ui/SettingsSection.svelte';
  import { toast } from '#lib/toaster.js';
  import { m } from '#lib/paraglide/messages.js';

  let { data, form: result = null } = $props();
</script>

<SettingsSection title={m.profile_section_about()} lede={m.profile_section_about_lede()} />

<section
  aria-label={m.profile_section_about()}
  class="rounded-lg border border-surface-200-800 bg-panel p-6 md:p-8"
>
  <p class="mb-6 max-w-prose text-muted">{m.account_about_private()}</p>
  <ProfileForm
    form={result?.form && 'username' in result.form.data
      ? { ...result.form, data: result.form.data }
      : data.form}
    action="?/save"
    section="about"
    submitLabel={m.account_about_save()}
    onsaved={() => toast.success(m.account_profile_saved())}
  />
</section>
