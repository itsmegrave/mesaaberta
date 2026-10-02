import '../../routes/layout.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import RichTextField from './RichTextField.svelte';
import RichTextFieldHarness from './RichTextFieldHarness.svelte';
import RichText from './RichText.svelte';

const editor = () => page.getByRole('textbox', { name: 'Notas' });
const ready = () => expect.element(page.getByRole('toolbar')).toBeVisible();
const stored = () => page.getByTestId('value').element().textContent;
// Select-all is Command+A in macOS Chromium and Control+A on the Linux CI runner.
const selectAll = /Mac/.test(navigator.platform) ? '{Meta>}a{/Meta}' : '{Control>}a{/Control}';

describe('RichTextField.svelte', () => {
  it('stands in as a plain textarea with the same name until the editor is ready, then keeps the name on a hidden input', async () => {
    render(RichTextField, { id: 'notes', name: 'notes', maxlength: 100, value: '<p>oi</p>' });

    // Before the editor loads, a native form would post this text, and the server makes paragraphs of it.
    expect(document.body.querySelector('textarea[name="notes"]')).not.toBeNull();
    await ready();

    // One control for the label, and the HTML still travels under the field's name.
    expect(document.body.querySelector('textarea')).toBeNull();
    expect(document.querySelectorAll('#notes')).toHaveLength(1);
    expect(
      document.body.querySelector<HTMLInputElement>('input[type="hidden"][name="notes"]')?.value,
    ).toBe('<p>oi</p>');
  });

  it('writes the HTML of what is typed and formatted into the bound value', async () => {
    render(RichTextFieldHarness);
    await ready();

    await userEvent.click(editor());
    await userEvent.keyboard('Olá');
    await expect.poll(stored).toBe('<p>Olá</p>');

    await page.getByRole('button', { name: 'Negrito' }).click();
    await userEvent.keyboard(' mundo');
    await expect.poll(stored).toBe('<p>Olá<strong> mundo</strong></p>');
  });

  it('shows a button as pressed while the cursor is in text with that format', async () => {
    render(RichTextFieldHarness, { initial: '<p>um <em>dois</em></p>' });
    await ready();

    await userEvent.click(editor());
    await userEvent.keyboard('{Control>}{End}{/Control}');
    await expect
      .element(page.getByRole('button', { name: 'Itálico' }))
      .toHaveAttribute('aria-pressed', 'true');
    await expect
      .element(page.getByRole('button', { name: 'Negrito' }))
      .toHaveAttribute('aria-pressed', 'false');
  });

  it('is an empty value, not an empty paragraph, when everything is deleted', async () => {
    render(RichTextFieldHarness, { initial: '<p>a</p>' });
    await ready();

    await userEvent.click(editor());
    await userEvent.keyboard(`${selectAll}{Backspace}`);

    await expect.poll(stored).toBe('');
  });

  it('adds a link that is safe and refuses one that is not', async () => {
    render(RichTextFieldHarness, { initial: '<p>site</p>' });
    await ready();
    await userEvent.click(editor());
    await userEvent.keyboard(selectAll);

    await page.getByRole('button', { name: 'Link' }).click();
    await page.getByLabelText('Endereço do link').fill('javascript:alert(1)');
    await page.getByRole('button', { name: 'Aplicar' }).click();
    await expect.element(page.getByText('Use um endereço http, https ou um e-mail.')).toBeVisible();
    expect(stored()).not.toContain('<a');

    await page.getByLabelText('Endereço do link').fill('exemplo.com');
    await page.getByRole('button', { name: 'Aplicar' }).click();
    await expect.poll(stored).toContain('href="https://exemplo.com"');
  });

  it('counts what is seen and warns past the limit, without counting the markup', async () => {
    render(RichTextFieldHarness, { initial: '<p><strong>abc</strong></p>', maxlength: 5 });
    await expect.element(page.getByText('3 de 5 caracteres')).toBeVisible();

    await userEvent.click(editor());
    await userEvent.keyboard('{Control>}{End}{/Control}def');

    await expect.element(page.getByText('6 de 5 caracteres')).toBeVisible();
    await expect.element(editor()).toHaveAttribute('aria-invalid', 'true');
  });

  it('moves along the toolbar with the arrow keys, which is one stop in the tab order', async () => {
    render(RichTextFieldHarness);
    await ready();

    const bold = page.getByRole('button', { name: 'Negrito' });
    ((await bold.element()) as HTMLElement).focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect.element(page.getByRole('button', { name: 'Itálico' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    await expect.element(bold).toHaveFocus();
  });

  it('brings in the editor without a style tag, which the CSP would block', async () => {
    const before = document.head.querySelectorAll('style').length;
    render(RichTextFieldHarness);
    await ready();

    expect(document.head.querySelectorAll('style').length).toBe(before);
  });
});

describe('RichText.svelte', () => {
  it('shows the formatting', async () => {
    render(RichText, { html: '<p>oi <strong>você</strong></p><ul><li>um</li></ul>' });

    await expect.element(page.getByText('você')).toBeVisible();
    expect(document.querySelector('strong')?.textContent).toBe('você');
    expect(document.querySelectorAll('li')).toHaveLength(1);
  });

  it('cleans whatever it is given, so stored markup cannot run code', async () => {
    const html =
      '<p onclick="x()">oi</p><script>window.hacked = true</script><img src=x onerror="window.hacked = true"><a href="javascript:alert(1)">l</a>';
    render(RichText, { html });

    await expect.element(page.getByText('oi')).toBeVisible();
    expect(document.body.querySelector('script, img, [onclick]')).toBeNull();
    expect(document.body.querySelector('a')).toBeNull();
    expect((window as unknown as { hacked?: boolean }).hacked).toBeUndefined();
  });

  it('shows old plain text as paragraphs', async () => {
    render(RichText, { html: 'linha um\nlinha <dois>\n\nsegundo' });

    expect(document.body.querySelectorAll('p')).toHaveLength(2);
    expect(document.body.textContent).toContain('linha <dois>');
  });

  it('draws nothing for an empty value', async () => {
    render(RichText, { html: '<p></p>' });

    expect(document.body.querySelector('.rich-text')).toBeNull();
  });
});
