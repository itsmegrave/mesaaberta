import { expect, test, type Page } from '@playwright/test';
import { asUser, createTable, uniqueTitle } from './support/app';
import { createUser } from './support/users';

test.skip(({ isMobile }) => isMobile, 'signed-in flows run on desktop only');

/** The bell, once the event behind a notification has been dispatched (after the response). */
async function bellSays(page: Page, name: string | RegExp) {
  await expect(async () => {
    await page.reload();
    await expect(page.getByRole('banner').getByRole('button', { name })).toBeVisible({
      timeout: 1000,
    });
  }).toPass({ timeout: 15_000 });
  return page.getByRole('banner').getByRole('button', { name });
}

test('the GM hears about a new player on the bell, opens it, and it is read', async ({
  browser,
}) => {
  const gm = await createUser('Mestra Ana');
  const gmSession = await asUser(browser, gm);
  const title = uniqueTitle('Mesa');
  const slug = await createTable(gmSession.page, { title });

  const player = await createUser('Bruno');
  const playerSession = await asUser(browser, player);
  await playerSession.page.goto(`/tables/${slug}`);
  await playerSession.page.getByRole('button', { name: 'Pegar vaga' }).click();
  await expect(playerSession.page.getByText('Você está nesta mesa.')).toBeVisible();

  const gmPage = gmSession.page;
  await gmPage.goto('/account/tables');
  const bell = await bellSays(gmPage, 'Notificações: 1 sem ler');
  await bell.click();
  await gmPage
    .getByRole('button', { name: new RegExp(`${player.username} entrou em ${title}`) })
    .click();

  await expect(gmPage).toHaveURL(new RegExp(`/tables/${slug}/manage$`));
  await expect(
    gmPage.getByRole('banner').getByRole('button', { name: 'Notificações', exact: true }),
  ).toBeVisible();

  // The GM removes the player, who finds it in the feed.
  await gmPage.goto(`/tables/${slug}`);
  await gmPage.getByRole('button', { name: 'Remover' }).click();
  await expect(gmPage.getByText('Ninguém entrou ainda.')).toBeVisible();

  const page = playerSession.page;
  await page.goto('/account/tables');
  await bellSays(page, 'Notificações: 1 sem ler');
  await page.goto('/notifications?category=registration');
  await expect(
    page.getByRole('main').getByText(`Sua vaga em ${title} foi encerrada pela mestria da mesa.`),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Marcar todas como lidas' }).click();
  await expect(page.getByRole('button', { name: 'Marcar todas como lidas' })).toHaveCount(0);

  await playerSession.context.close();
  await gmSession.context.close();
});
