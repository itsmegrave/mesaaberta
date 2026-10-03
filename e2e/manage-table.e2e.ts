import { expect, test } from '@playwright/test';
import { asUser, createTable, uniqueTitle } from './support/app';
import { createUser } from './support/users';

// The GM's manage page: requests, players and recent activity, each person in their own browser.
test.skip(({ isMobile }) => isMobile, 'signed-in flows run on desktop only');

test('the GM approves a request and removes a player from the manage page, after confirming', async ({
  browser,
}) => {
  const gm = await createUser('Mestra Gerente');
  const { page: gmPage, context: gmContext } = await asUser(browser, gm);
  const title = uniqueTitle('Mesa Gerenciada');
  const slug = await createTable(gmPage, { title, joinMode: 'approval' });

  const bruno = await createUser('Bruno Pedido');
  const { page, context } = await asUser(browser, bruno);
  await page.goto(`/tables/${slug}`);
  await page.getByRole('button', { name: 'Pedir vaga' }).click();
  await page.getByLabel(/Mensagem para o mestre/).fill('Sou o Bruno, nunca joguei Tormenta.');
  await page.getByRole('button', { name: 'Enviar pedido' }).click();
  await expect(page.getByText(/pedido/i).first()).toBeVisible();

  // From Minhas mesas, "Gerenciar mesa" opens the manage page.
  await gmPage.goto('/account/tables');
  await gmPage
    .getByRole('article')
    .filter({ hasText: title })
    .getByRole('link', { name: 'Gerenciar mesa' })
    .click();
  await expect(gmPage).toHaveURL(new RegExp(`/tables/${slug}/manage$`));
  await expect(gmPage.getByRole('heading', { level: 1 })).toHaveText(title);
  // The trail names the table (not its slug) and links back to it.
  const trail = gmPage.getByRole('navigation', { name: 'Trilha de navegação' });
  await expect(trail.getByRole('link', { name: 'Minhas mesas' })).toBeVisible();
  await expect(trail.getByRole('link', { name: title })).toHaveAttribute('href', `/tables/${slug}`);
  await expect(trail.getByText('Jogadores e pedidos')).toHaveAttribute('aria-current', 'page');

  const requests = gmPage.getByRole('region', { name: 'Pedidos de vaga' });
  await expect(requests.getByText(`@${bruno.username}`)).toBeVisible();
  await expect(requests.getByText('Sou o Bruno, nunca joguei Tormenta.')).toBeVisible();
  await requests.getByRole('button', { name: 'Aprovar' }).click();

  const players = gmPage.getByRole('region', { name: 'Participantes' });
  await expect(players.getByText(`@${bruno.username}`)).toBeVisible();
  await expect(players.getByText(/Na mesa desde/)).toBeVisible();
  await expect(requests.getByText('Nenhum pedido esperando.')).toBeVisible();
  await expect(gmPage.getByRole('region', { name: 'Atividade recente' })).toContainText(
    `Você aprovou @${bruno.username}`,
  );

  // Removing asks first; Cancelar keeps the player.
  const rowMenu = players.getByRole('button', { name: `Mais ações: @${bruno.username}` });
  await rowMenu.click();
  await gmPage.getByRole('menuitem', { name: 'Remover da mesa…' }).click();
  const dialog = gmPage.getByRole('alertdialog');
  await expect(dialog).toContainText(`Remover @${bruno.username} da mesa?`);
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(players.getByText(`@${bruno.username}`)).toBeVisible();

  await rowMenu.click();
  await gmPage.getByRole('menuitem', { name: 'Remover da mesa…' }).click();
  await gmPage.getByRole('alertdialog').getByRole('button', { name: 'Remover' }).click();
  await expect(players.getByText(`@${bruno.username}`)).toHaveCount(0);
  await expect(gmPage.getByRole('region', { name: 'Atividade recente' })).toContainText(
    `Você removeu @${bruno.username}`,
  );

  // Only the GM gets in.
  const other = await page.goto(`/tables/${slug}/manage`);
  expect(other?.status()).toBe(403);

  await context.close();
  await gmContext.close();
});
