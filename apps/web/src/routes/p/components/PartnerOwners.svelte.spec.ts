import '../../layout.css';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PartnerOwners from './PartnerOwners.svelte';

const ANA = '00000000-0000-4000-8000-0000000000aa';
const owner = (n: number, username: string) => ({
  profileId: `00000000-0000-4000-8000-0000000000${n}0`,
  username,
  since: new Date('2026-10-10T12:00:00Z'),
  submitter: false,
});
const anaRow = { profileId: ANA, username: 'ana', since: new Date(), submitter: true };
const invite = (n: number, username: string) => ({
  id: `00000000-0000-4000-8000-0000000001${n}0`,
  username,
  createdAt: new Date('2026-10-24T12:00:00Z'),
  expiresAt: new Date('2026-10-31T12:00:00Z'),
});

describe('Quem cuida do parceiro', () => {
  it('lists the owners and the invites that wait, and offers to invite', async () => {
    render(PartnerOwners, {
      partner: 'Taverna',
      owners: [anaRow, owner(1, 'caio')],
      invitations: [invite(1, 'lia')],
      you: ANA,
    });
    await expect
      .element(page.getByRole('heading', { name: 'Quem cuida do parceiro' }))
      .toBeVisible();
    await expect.element(page.getByText('Você · cadastrou o parceiro')).toBeVisible();
    await expect.element(page.getByText(/^Cuida desde/)).toBeVisible();
    await expect.element(page.getByText('Convite pendente')).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Cancelar convite' })).toBeVisible();
    await expect.element(page.getByLabelText('Convidar pelo @usuário')).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Mais ações: @caio' })).toBeVisible();
  });

  it('has no menu on the one owner left, and no invite form at five accounts', async () => {
    render(PartnerOwners, {
      partner: 'Taverna',
      owners: [anaRow],
      invitations: [invite(1, 'b'), invite(2, 'c'), invite(3, 'd'), invite(4, 'e')],
      you: ANA,
    });
    await expect
      .element(page.getByRole('button', { name: 'Mais ações: @ana' }))
      .not.toBeInTheDocument();
    await expect.element(page.getByText(/já tem 5 contas/)).toBeVisible();
    await expect.element(page.getByLabelText('Convidar pelo @usuário')).not.toBeInTheDocument();
  });
});
