import '../../layout.css';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

const now = new Date('2026-09-30T12:00:00Z');
const work = [
  {
    id: '00000000-0000-4000-8000-0000000000e1',
    type: 'JoinApproved',
    state: 'failed' as const,
    createdAt: new Date('2026-09-30T10:00:00Z'),
    attempts: 8,
    maxAttempts: 8,
    nextAttemptAt: now,
    handledBy: ['bell'],
    lastError: 'Error: Resend answered 500',
  },
  {
    id: '00000000-0000-4000-8000-0000000000e2',
    type: 'TableCreated',
    state: 'pending' as const,
    createdAt: new Date('2026-09-30T11:59:00Z'),
    attempts: 0,
    maxAttempts: 8,
    nextAttemptAt: now,
    handledBy: [],
    lastError: null,
  },
];
const health = {
  pending: 1,
  retrying: 0,
  failed: 1,
  oldestPendingSeconds: 60,
  byType: [
    { type: 'JoinApproved', pending: 0, failed: 1 },
    { type: 'TableCreated', pending: 1, failed: 0 },
  ],
};
const show = (over = {}) =>
  render(Page, { data: { health, work, canRetry: false, now, ...over } as never });

describe('admin operations', () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  it('shows the queue at a glance and what each event has done and failed at', async () => {
    show();

    await expect.element(page.getByText('Espera mais antiga')).toBeVisible();
    await expect.element(page.getByText('1 min', { exact: true }).first()).toBeVisible();
    await expect.element(page.getByRole('rowheader', { name: /JoinApproved/ })).toBeVisible();
    await expect.element(page.getByText('8 de 8')).toBeVisible();
    await expect.element(page.getByText('Error: Resend answered 500')).toBeVisible();
    await expect.element(page.getByText('bell', { exact: true })).toBeVisible();
    await expect.element(page.getByText('Nenhuma etapa ainda')).toBeVisible();
  });

  it('is read-only, with no retry button, until the deploy turns retries on', async () => {
    show();

    await expect.element(page.getByText(/Somente leitura/)).toBeVisible();
    await expect
      .element(page.getByRole('button', { name: /Tentar de novo/ }))
      .not.toBeInTheDocument();
  });

  it('offers a retry for a failed event only, once retries are on', async () => {
    show({ canRetry: true });

    await expect
      .element(page.getByRole('button', { name: 'Tentar de novo: JoinApproved' }))
      .toBeVisible();
    expect(page.getByRole('button', { name: /Tentar de novo/ }).elements()).toHaveLength(1);
  });

  it('says so when nothing is open', async () => {
    show({
      work: [],
      health: { pending: 0, retrying: 0, failed: 0, oldestPendingSeconds: null, byType: [] },
    });

    await expect.element(page.getByText('Nada esperando')).toBeVisible();
    await expect.element(page.getByText(/Nada em aberto/)).toBeVisible();
  });
});
