<script lang="ts">
  import Button from './Button.svelte';
  import EditorForm from './EditorForm.svelte';
  import FormSection from './ui/FormSection.svelte';
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
  cancelHref="/t"
>
  <FormSection id="first-part" step={1} title="Primeira parte">
    <label for="name">Nome</label><input id="name" name="name" />
  </FormSection>
  <FormSection title="Segunda parte" hint="Para que serve." icon="copy">
    <p>Conteúdo</p>
  </FormSection>
  {#snippet actions()}
    <Button type="submit">Salvar</Button>
  {/snippet}
  {#snippet preview()}
    <a href="/t/preview">O cartão</a>
  {/snippet}
  {#snippet details()}
    <p>Detalhes do cartão</p>
  {/snippet}
</EditorForm>
