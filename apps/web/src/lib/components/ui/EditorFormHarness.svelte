<script lang="ts">
  import MAButton from './MAButton.svelte';
  import EditorForm from './EditorForm.svelte';
  import FormSection from './FormSection.svelte';
  import type { Problem } from '#lib/forms/field-errors.js';

  let {
    problems = [],
    banner,
    note,
    submit = (event: SubmitEvent) => event.preventDefault(),
  }: {
    problems?: Problem[];
    banner?: string;
    note?: string;
    submit?: (event: SubmitEvent) => void;
  } = $props();
</script>

<EditorForm
  action="?/save"
  controller={{ submit, blur: () => {} }}
  {problems}
  {banner}
  {note}
  cancelHref="/tables"
>
  <FormSection id="first-part" step={1} title="Primeira parte">
    <label for="name">Nome</label><input id="name" name="name" />
  </FormSection>
  <FormSection title="Segunda parte" hint="Para que serve." icon="copy">
    <p>Conteúdo</p>
  </FormSection>
  {#snippet actions()}
    <MAButton type="submit">Salvar</MAButton>
  {/snippet}
  {#snippet preview()}
    <a href="/t/preview">O cartão</a>
  {/snippet}
  {#snippet details()}
    <p>Detalhes do cartão</p>
  {/snippet}
</EditorForm>
