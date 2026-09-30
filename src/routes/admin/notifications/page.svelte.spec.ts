import '../../layout.css';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { defaults } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { announcementSchema } from '$lib/notifications/announcement';
import { ANNOUNCEMENT_ICONS, TONE_ICON } from '$lib/notifications/kinds';
import { ICONS } from '$lib/icons/lucide.generated';
import Page from './+page.svelte';

const sizes = { all_active_users: 120, game_masters: 14, active_players: 1 };
const form = (over = {}, message?: unknown) => ({
  ...defaults({ ...over }, zod4(announcementSchema)),
  ...(message ? { message } : {}),
});
const sent = {
  id: '00000000-0000-4000-8000-0000000000e1',
  title: 'Novas tags',
  body: 'Sugira tags ao abrir uma mesa.',
  icon: 'sparkles' as const,
  tone: 'announcement' as const,
  link: '/changelog',
  audience: 'specific_user' as const,
  recipient: 'bruno',
  author: 'admin',
  notified: 1,
  sentAt: new Date('2026-09-28T15:00:00Z'),
  status: 'delivered' as const,
};

const show = (data: { form: unknown; history?: unknown[] }) =>
  render(Page, { data: { sizes, history: [], ...data } as never });

const preview = () => page.getByTestId('announcement-preview');
const previewText = () => preview().element().textContent ?? '';

describe('admin notifications', () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  it('previews the bell as the admin types, with the tone’s icon until one is picked', async () => {
    show({ form: form() });
    await expect.poll(previewText).toContain('O título aparece aqui.');

    await page.getByLabelText('Título').fill('Manutenção no sábado');
    await page.getByLabelText('Mensagem').fill('Fora do ar das 2h às 4h.');

    await expect.poll(previewText).toContain('Manutenção no sábado: Fora do ar das 2h às 4h.');
    const drawn = () => preview().element().querySelector('svg')!.innerHTML;
    const infoIcon = drawn();

    await page.getByText('Presente').click();
    await expect.poll(drawn).not.toBe(infoIcon);
  });

  it('shows how many accounts each audience reaches, and asks for the person only when it is one', async () => {
    show({ form: form() });

    await expect.element(page.getByText('120 contas')).toBeVisible();
    await expect.element(page.getByText('1 conta', { exact: true })).toBeVisible();
    await expect.element(page.getByLabelText('Nome de usuário ou ID')).not.toBeInTheDocument();

    await page.getByText('Uma pessoa').click();

    await expect.element(page.getByLabelText('Nome de usuário ou ID')).toBeVisible();
  });

  it('draws every announcement option and updates the preview to the selected icon', async () => {
    show({ form: form() });
    const bodyFor = (icon: (typeof ANNOUNCEMENT_ICONS)[number]) => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.innerHTML = ICONS[icon === 'alert-triangle' ? 'triangle-alert' : icon].body;
      return svg.innerHTML;
    };
    for (const icon of ANNOUNCEMENT_ICONS) {
      const input = document.querySelector<HTMLInputElement>(
        `input[name="icon"][value="${icon}"]`,
      )!;
      const label = input.closest('label')!;
      expect(label.querySelector('svg')!.innerHTML).toBe(bodyFor(icon));
      label.click();
      await expect
        .poll(() => preview().element().querySelector('svg')!.innerHTML)
        .toBe(bodyFor(icon));
    }
    document.querySelector<HTMLInputElement>('input[name="icon"][value=""]')!.click();
    await expect
      .poll(() => preview().element().querySelector('svg')!.innerHTML)
      .toBe(bodyFor(TONE_ICON.info));
  });

  it('asks to confirm with the count, and editing takes the confirm step away', async () => {
    show({ form: form({ title: 'Oi', body: 'Tudo bem?' }, { code: 'confirm', count: 120 }) });

    await expect.element(page.getByText('Esta notificação vai para 120 contas.')).toBeVisible();
    const confirm = page.getByRole('button', { name: 'Enviar agora' });
    await expect.element(confirm).toHaveAttribute('name', 'confirmed');
    await expect.element(confirm).toHaveAttribute('value', 'true');

    await page.getByLabelText('Título').fill('Oi de novo');

    await expect.element(confirm).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Revisar envio' })).toBeVisible();
  });

  it('names the one person it goes to', async () => {
    show({
      form: form(
        { title: 'Oi', body: 'Tudo bem?', audience: 'specific_user', recipient: 'bruno' },
        { code: 'confirm', count: 1, recipient: 'bruno' },
      ),
    });

    await expect.element(page.getByText('Esta notificação vai para @bruno.')).toBeVisible();
  });

  it('lists what was sent: text, audience, reach, author and status', async () => {
    show({ form: form(), history: [sent] });
    const item = page.getByRole('listitem').filter({ hasText: 'Novas tags' });

    await expect.element(item.getByText('Sugira tags ao abrir uma mesa.')).toBeVisible();
    await expect.element(item.getByText('Para @bruno')).toBeVisible();
    await expect.element(item.getByText('Chegou a 1 conta')).toBeVisible();
    await expect.element(item.getByText('Por @admin')).toBeVisible();
    await expect.element(item.getByText('Entregue')).toBeVisible();
  });

  it('says so when nothing was sent yet', async () => {
    show({ form: form() });
    await expect.element(page.getByText('Nenhuma notificação enviada ainda.')).toBeVisible();
  });
});
