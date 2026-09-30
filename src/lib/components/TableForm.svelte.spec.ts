import { page, userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TableFormHarness from './TableFormHarness.svelte';

const systems = [
  { name: 'Daggerheart', slug: 'daggerheart' },
  { name: 'Tormenta 20 (T20)', slug: 'tormenta-20-t20' },
];

const props = { systems, submitLabel: 'Abrir mesa' };

describe('TableForm', () => {
  it('offers every system in a searchable list, and asks for one', async () => {
    render(TableFormHarness, props);

    const input = page.getByRole('combobox', { name: 'Sistema de RPG' });
    await expect.element(input).toBeVisible();
    await expect.element(input).toHaveAttribute('placeholder', 'Escolha um sistema');
    await expect.element(input).toBeRequired();

    await input.fill('tormenta');
    await expect
      .element(page.getByRole('option', { name: 'Tormenta 20 (T20)' }))
      .toBeInTheDocument();
    await expect.element(page.getByRole('option', { name: 'Daggerheart' })).not.toBeInTheDocument();
  });

  it("says the time is in the GM's own zone and links to change it, without asking for one", async () => {
    render(TableFormHarness, props);

    await expect.element(page.getByText(/No seu fuso, America\/Sao Paulo \(GMT-3\)/)).toBeVisible();
    await expect
      .element(page.getByRole('link', { name: 'Mudar no perfil' }))
      .toHaveAttribute('href', '/account/profile');
    await expect.element(page.getByLabelText('Fuso horário')).not.toBeInTheDocument();
  });

  it('asks for the duration in hours, half hours allowed, and previews it in hours', async () => {
    render(TableFormHarness, props);

    const field = page.getByLabelText('Duração (horas)');
    await expect.element(field).toHaveValue(4);
    await expect.element(field).toHaveAttribute('step', '0.5');
    await expect.element(field).toHaveAttribute('max', '24');

    await field.fill('2.5');
    await expect.element(page.getByText(/2,5 horas/)).toBeVisible();
  });

  it('starts as a one-shot without the repeat fields, and shows them for a campaign', async () => {
    render(TableFormHarness, props);

    await expect.element(page.getByLabelText('Repete')).not.toBeInTheDocument();

    await page.getByLabelText('Campanha (várias sessões)').click();

    await expect.element(page.getByLabelText('Repete')).toBeVisible();
    await expect.element(page.getByLabelText('Última sessão até')).toBeVisible();
  });

  it('groups the form into the four numbered steps and keeps the preview in sync', async () => {
    render(TableFormHarness, props);

    for (const heading of ['Sobre a mesa', 'Quando', 'Vagas e entrada', 'Imagem']) {
      await expect.element(page.getByRole('heading', { name: heading })).toBeVisible();
    }

    await page.getByLabelText('Título').fill('A Cripta do Rei Afogado');
    await page.getByRole('combobox', { name: 'Sistema de RPG' }).fill('dagger');
    await page.getByRole('option', { name: 'Daggerheart' }).click();
    // The slider moves a seat at a time with the arrow keys.
    const seats = page.getByRole('slider', { name: 'Vagas' });
    await expect.element(seats).toHaveAttribute('aria-valuenow', '5');
    (seats.element() as HTMLElement).focus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect.element(seats).toHaveAttribute('aria-valuenow', '4');
    await expect.element(page.getByText('4 vagas', { exact: true })).toBeVisible();

    const preview = page.getByRole('complementary');
    await expect.element(preview.getByText('A Cripta do Rei Afogado')).toBeVisible();
    await expect.element(preview.getByText('Daggerheart')).toBeVisible();
    await expect.element(preview.getByText('One-shot')).toBeVisible();
    await expect.element(preview.getByText('4 vagas restantes')).toBeVisible();
  });

  it('does not let the seats go below the ones already taken', async () => {
    render(TableFormHarness, { ...props, values: { capacity: 3 }, minCapacity: 3 });

    const seats = page.getByRole('slider', { name: 'Vagas' });
    await expect.element(seats).toHaveAttribute('aria-valuemin', '3');
    (seats.element() as HTMLElement).focus();
    await userEvent.keyboard('{Home}');
    await expect.element(seats).toHaveAttribute('aria-valuenow', '3');
  });

  it('says why the seats cannot go lower, and where to remove players', async () => {
    render(TableFormHarness, {
      ...props,
      values: { capacity: 4 },
      minCapacity: 3,
      manageHref: '/tables/mesa/manage',
    });

    await expect
      .element(page.getByText(/3 pessoas já estão na mesa, então este é o mínimo\./))
      .toBeVisible();
    await expect
      .element(page.getByRole('link', { name: 'Remover pessoas da mesa' }))
      .toHaveAttribute('href', '/tables/mesa/manage');
  });

  it('takes the current image off on save, and can take that back', async () => {
    render(TableFormHarness, { ...props, imageUrl: 'https://x.supabase.co/img.png' });
    const removeField = () => document.querySelector('input[name="removeImage"]');

    await expect.element(page.getByRole('button', { name: 'Trocar imagem' })).toBeVisible();
    await page.getByRole('button', { name: 'Remover imagem' }).click();
    await expect.element(page.getByText('A imagem sai quando você salvar.')).toBeVisible();
    expect(removeField()?.getAttribute('value')).toBe('true');

    await page.getByRole('button', { name: 'Desfazer' }).click();
    await expect.element(page.getByRole('button', { name: 'Remover imagem' })).toBeVisible();
    expect(removeField()).toBeNull();
  });

  it('posts as multipart to its action, so an image can travel with it', async () => {
    render(TableFormHarness, { ...props, action: '?/save' });

    const form = page.getByRole('button', { name: 'Abrir mesa' }).element().closest('form');
    expect(form?.method).toBe('post');
    expect(form?.enctype).toBe('multipart/form-data');
    expect(form?.getAttribute('action')).toBe('?/save');
  });

  it('accepts only the image types the server accepts', async () => {
    render(TableFormHarness, props);

    await expect.element(page.getByRole('button', { name: 'Escolher imagem' })).toBeVisible();
    expect(document.querySelector('input#image')?.getAttribute('accept')).toBe(
      'image/png,image/jpeg,image/webp',
    );
  });

  it('keeps what was typed and marks each field that has a problem', async () => {
    render(TableFormHarness, {
      ...props,
      values: { title: 'ab' },
      errors: { title: ['too_small'], capacity: ['invalid_type'] },
    });

    await expect.element(page.getByLabelText('Título')).toHaveValue('ab');
    await expect.element(page.getByLabelText('Título')).toHaveAttribute('aria-invalid', 'true');
    await expect.element(page.getByText('Muito curto ou pequeno demais.')).toBeVisible();
    await expect.element(page.getByText('Corrija os campos marcados.')).toBeVisible();
  });

  it('shows the current image when editing', async () => {
    render(TableFormHarness, { ...props, imageUrl: 'https://x.supabase.co/img.png' });

    await expect.element(page.getByText('Imagem atual. Envie outra para trocar.')).toBeVisible();
  });

  it('has no problem message when there is nothing wrong', async () => {
    render(TableFormHarness, props);

    await expect.element(page.getByText('Corrija os campos marcados.')).not.toBeInTheDocument();
  });

  it('shows the image problem next to the image field, from the form message', async () => {
    render(TableFormHarness, { ...props, message: { code: 'not_an_image', field: 'image' } });

    await expect.element(page.getByText('Use uma imagem PNG, JPEG ou WebP.')).toBeVisible();
    const choose = page.getByRole('button', { name: 'Escolher imagem' });
    await expect.element(choose).toHaveAttribute('aria-invalid', 'true');
    await expect.element(choose).toHaveAttribute('aria-describedby', 'image-hint image-error');
  });

  it('says a refused permission at the top of the form', async () => {
    render(TableFormHarness, { ...props, message: { code: 'forbidden' } });

    await expect.element(page.getByText('Você não tem permissão para fazer isso.')).toBeVisible();
  });

  it('says how long to wait when the person did this too often', async () => {
    render(TableFormHarness, { ...props, message: { code: 'rate_limited', retryAfter: 900 } });

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('Você fez isso muitas vezes em pouco tempo. Tente de novo em 15 min.');
  });
});
