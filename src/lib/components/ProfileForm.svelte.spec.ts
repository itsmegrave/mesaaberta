import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { initialForm, issueErrors } from '$lib/forms/contract';
import ProfileForm from './ProfileForm.svelte';
import { profileSchema, type ProfileInput } from '$lib/profile/schema';

// There is no SvelteKit app around a component test, so the step that hands a result to the router
// has nothing to talk to. What the form shows is the same either way.
vi.mock('$app/forms', async (original) => ({
  ...(await original<typeof import('$app/forms')>()),
  applyAction: vi.fn(),
}));

const empty: ProfileInput = {
  username: '',
  name: '',
  ageRange: '',
  gender: '',
  genderOther: '',
  city: '',
  timezone: '',
  linkNetwork: [],
  linkUrl: [],
};

// `withErrors` is what the form gets back from a failed post: the values with the errors attached.
const setup = async (
  values: Partial<ProfileInput> = {},
  checkUsername = vi.fn(),
  { withErrors = false } = {},
) => {
  const form = initialForm({ ...empty, ...values });
  const parsed = profileSchema.safeParse(form.data);
  if (withErrors && !parsed.success) form.errors = issueErrors(parsed.error.issues);
  render(ProfileForm, { form, checkUsername });

  return { checkUsername };
};

const urlFields = () => page.getByLabelText(/^Endereço do link/);
const urls = () =>
  urlFields()
    .elements()
    .map((el) => (el as HTMLInputElement).value);

describe('ProfileForm', () => {
  it('is a plain POST form where every field has a label and only the username is required', async () => {
    await setup();

    const form = page
      .getByRole('button', { name: 'Salvar e continuar' })
      .element()
      .closest('form')!;
    expect(form.method).toBe('post');
    await expect.element(page.getByLabelText('Nome de usuário')).toBeRequired();
    for (const label of ['Nome', 'Faixa etária', 'Gênero', 'Cidade']) {
      await expect
        .element(page.getByLabelText(new RegExp(`^${label}\\s*\\(opcional\\)`)))
        .not.toBeRequired();
    }
  });

  // The age and the gender are the same combobox as the timezone: type to narrow, or open the list.
  const openList = (label: RegExp | string) =>
    page.getByRole('button', { name: new RegExp(`^Abrir a lista: ${label}`) }).click();
  const sent = (name: string) =>
    document.querySelector<HTMLInputElement>(`input[type="hidden"][name="${name}"]`)?.value;

  describe('age range', () => {
    it('is a list of ranges, not an exact age, with no answer as the default', async () => {
      await setup();

      const range = page.getByRole('combobox', { name: /^Faixa etária/ });
      await expect.element(range).toHaveValue('');
      await expect.element(range).toHaveAttribute('placeholder', 'Prefiro não informar');
      await openList('Faixa etária');
      await expect
        .poll(() =>
          page
            .getByRole('option')
            .elements()
            .map((option) => option.textContent?.trim()),
        )
        .toEqual([
          'Prefiro não informar',
          '13 a 17 anos',
          '18 a 24 anos',
          '25 a 34 anos',
          '35 a 44 anos',
          '45 a 54 anos',
          '55 anos ou mais',
        ]);
    });

    it('shows the range the person saved, and sends it', async () => {
      await setup({ ageRange: '35_44' });

      await expect
        .element(page.getByRole('combobox', { name: /^Faixa etária/ }))
        .toHaveValue('35 a 44 anos');
      expect(sent('ageRange')).toBe('35_44');
    });

    it('sends nothing for "Prefiro não informar"', async () => {
      await setup({ ageRange: '35_44' });

      await openList('Faixa etária');
      await page.getByRole('option', { name: 'Prefiro não informar' }).click();

      await expect.poll(() => sent('ageRange')).toBeUndefined();
    });
  });

  describe('gender', () => {
    it('is a list of options with no answer as the default', async () => {
      await setup();

      const gender = page.getByRole('combobox', { name: /^Gênero/ });
      await expect.element(gender).toHaveValue('');
      await openList('Gênero');
      await expect
        .poll(() =>
          page
            .getByRole('option')
            .elements()
            .map((option) => option.textContent?.trim()),
        )
        .toEqual([
          'Prefiro não informar',
          'Mulher',
          'Homem',
          'Mulher trans',
          'Homem trans',
          'Pessoa não binária',
          'Agênero',
          'Gênero fluido',
          'Travesti',
          'Outro',
        ]);
    });

    it('asks for own words only once "Outro" is picked', async () => {
      await setup();

      const ownWords = () => page.getByLabelText('Como você se identifica?');
      await expect.element(ownWords()).not.toBeInTheDocument();

      await openList('Gênero');
      await page.getByRole('option', { name: 'Outro' }).click();
      await expect.element(ownWords()).toBeVisible();
      await expect.element(ownWords()).not.toBeRequired();
    });

    it('shows what the person saved, own words included', async () => {
      await setup({ gender: 'other', genderOther: 'demigênero' });

      await expect.element(page.getByRole('combobox', { name: /^Gênero/ })).toHaveValue('Outro');
      expect(sent('gender')).toBe('other');
      await expect
        .element(page.getByLabelText('Como você se identifica?'))
        .toHaveValue('demigênero');
    });
  });

  it('shows what it was given, such as a username suggested from the sign-in name', async () => {
    await setup({ username: 'ana-souza', name: 'Ana Souza' });

    await expect.element(page.getByLabelText('Nome de usuário')).toHaveValue('ana-souza');
    await expect.element(page.getByLabelText(/^Nome(?! de usuário)/)).toHaveValue('Ana Souza');
  });

  it('does not post a form that is not valid', async () => {
    const post = vi.spyOn(window, 'fetch');
    await setup();

    await page.getByRole('button', { name: 'Salvar e continuar' }).click();
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(post).not.toHaveBeenCalled();
    post.mockRestore();
  });

  it('says what is wrong with the username next to the field, described by it', async () => {
    await setup({}, vi.fn(), { withErrors: true });

    const field = page.getByLabelText('Nome de usuário');
    await expect.element(field).toHaveAttribute('aria-invalid', 'true');
    await expect.element(page.getByText('Escolha um nome de usuário.')).toBeVisible();
    expect(field.element().getAttribute('aria-describedby')).toContain('username-error');
  });

  describe('the username check', () => {
    it('says the name is free once the server answers, and only asks once typing stops', async () => {
      const check = vi.fn().mockResolvedValue('free');
      await setup({}, check);

      await userEvent.type(page.getByLabelText('Nome de usuário'), 'Ana-Maria');

      await expect.element(page.getByText('Esse nome está livre.')).toBeVisible();
      // Not once per key: the check waits for a pause. (A slow test machine can make a pause mid-word,
      // so this does not insist on exactly one call.)
      expect(check.mock.calls.length).toBeGreaterThan(0);
      expect(check.mock.calls.length).toBeLessThan('Ana-Maria'.length);
      expect(check).toHaveBeenLastCalledWith('ana-maria', expect.any(AbortSignal));
    });

    it('cancels an older username check and ignores its late answer', async () => {
      let finish!: (value: 'taken') => void;
      const check = vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finish = resolve;
            }),
        )
        .mockResolvedValue('free');
      await setup({}, check);
      await page.getByLabelText('Nome de usuário').fill('ana');
      await expect.poll(() => check.mock.calls.length).toBe(1);
      const signal = check.mock.calls[0][1] as AbortSignal;
      await page.getByLabelText('Nome de usuário').fill('bruno');
      await expect.element(page.getByText('Esse nome está livre.')).toBeVisible();
      finish('taken');
      await expect
        .element(page.getByText('Esse nome já está em uso. Escolha outro.'))
        .not.toBeInTheDocument();
      expect(signal.aborted).toBe(true);
    });

    it('says the name is taken, as an error tied to the field', async () => {
      await setup({}, vi.fn().mockResolvedValue('taken'));

      await userEvent.type(page.getByLabelText('Nome de usuário'), 'bruno');

      await expect
        .element(page.getByText('Esse nome já está em uso. Escolha outro.'))
        .toBeVisible();
      await expect
        .element(page.getByLabelText('Nome de usuário'))
        .toHaveAttribute('aria-invalid', 'true');
    });

    it('does not ask the server about a name that is wrong anyway', async () => {
      const check = vi.fn().mockResolvedValue('free');
      await setup({}, check);

      await userEvent.type(page.getByLabelText('Nome de usuário'), 'a');
      await new Promise((resolve) => setTimeout(resolve, 600));

      expect(check).not.toHaveBeenCalled();
    });

    it('lets the person go on when the check cannot be made', async () => {
      await setup({}, vi.fn().mockRejectedValue(new Error('offline')));

      await userEvent.type(page.getByLabelText('Nome de usuário'), 'ana');

      await expect
        .element(page.getByText('Não deu para verificar agora. Você ainda pode salvar.'))
        .toBeVisible();
      await expect.element(page.getByRole('button', { name: 'Salvar e continuar' })).toBeEnabled();
    });
  });

  describe('the links', () => {
    it('starts with the links it was given, each with a network and an address', async () => {
      await setup({
        username: 'ana',
        linkNetwork: ['instagram', 'website'],
        linkUrl: ['https://instagram.com/ana', 'https://ana.example'],
      });

      expect(urls()).toEqual(['https://instagram.com/ana', 'https://ana.example']);
      await expect.element(page.getByLabelText('Rede do link 2')).toHaveValue('website');
    });

    it('adds a row, focused, and sends the links as parallel fields the server reads in order', async () => {
      await setup({ username: 'ana' });

      await page.getByRole('button', { name: 'Adicionar link' }).click();

      await expect.element(page.getByLabelText('Endereço do link 1')).toHaveFocus();
      await expect
        .element(page.getByLabelText('Endereço do link 1'))
        .toHaveAttribute('name', 'linkUrl');
      await expect
        .element(page.getByLabelText('Rede do link 1'))
        .toHaveAttribute('name', 'linkNetwork');
    });

    it('removes a row and keeps the others as they were typed', async () => {
      await setup({
        username: 'ana',
        linkNetwork: ['instagram', 'x', 'website'],
        linkUrl: ['https://instagram.com/a', 'https://x.com/a', 'https://a.example'],
      });

      await page.getByRole('button', { name: 'Remover link 2' }).click();

      expect(urls()).toEqual(['https://instagram.com/a', 'https://a.example']);
      await expect.element(page.getByLabelText('Rede do link 2')).toHaveValue('website');
      await expect.element(page.getByText('Link removido.')).toBeInTheDocument();
    });

    it('moves a row up and down with buttons, keeping its network with its address', async () => {
      await setup({
        username: 'ana',
        linkNetwork: ['instagram', 'x'],
        linkUrl: ['https://instagram.com/a', 'https://x.com/a'],
      });

      await page.getByRole('button', { name: 'Subir link 2' }).click();

      expect(urls()).toEqual(['https://x.com/a', 'https://instagram.com/a']);
      await expect.element(page.getByLabelText('Rede do link 1')).toHaveValue('x');
      await expect.element(page.getByLabelText('Rede do link 2')).toHaveValue('instagram');
      await expect.element(page.getByRole('button', { name: 'Subir link 1' })).toBeDisabled();
      await expect.element(page.getByRole('button', { name: 'Descer link 2' })).toBeDisabled();
    });

    it('stops adding at the limit', async () => {
      await setup({
        username: 'ana',
        linkNetwork: Array(10).fill('website'),
        linkUrl: Array.from({ length: 10 }, (_, i) => `https://a.example/${i}`),
      });

      await expect.element(page.getByRole('button', { name: 'Adicionar link' })).toBeDisabled();
    });

    it('flags the row with the bad address, not the others', async () => {
      await setup(
        {
          username: 'ana',
          linkNetwork: ['instagram', 'website'],
          linkUrl: ['https://instagram.com/a', 'javascript:alert(1)'],
        },
        vi.fn(),
        { withErrors: true },
      );

      await expect
        .element(page.getByLabelText('Endereço do link 2'))
        .toHaveAttribute('aria-invalid', 'true');
      await expect
        .element(page.getByLabelText('Endereço do link 1'))
        .not.toHaveAttribute('aria-invalid');
    });
  });
});
