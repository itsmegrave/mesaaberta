import { expect, test } from '@playwright/test';
import { asUser, createTable, uniqueTitle } from './support/app';
import { createUser } from './support/users';

test.skip(({ isMobile }) => isMobile, 'signed-in flows run on desktop only');

test('a player asks the GM a question before joining, the GM answers, and the table chat opens after joining', async ({
  browser,
}) => {
  const gm = await createUser('Mestra Ana');
  const gmSession = await asUser(browser, gm);
  const title = uniqueTitle('Mesa');
  const slug = await createTable(gmSession.page, { title });

  const player = await createUser('Bruno');
  const playerSession = await asUser(browser, player);
  const playerPage = playerSession.page;
  const errors: string[] = [];
  playerPage.on('pageerror', (error) => errors.push(error.message));

  // Before joining: a direct message to the GM.
  await playerPage.goto(`/tables/${slug}`);
  await playerPage.getByRole('button', { name: 'Falar com o mestre' }).click();
  await expect(playerPage).toHaveURL(/\/messages\/[0-9a-f-]+/);
  await playerPage.getByRole('textbox', { name: 'Mensagem' }).fill('Ainda tem vaga?');
  await playerPage.keyboard.press('Enter');
  await expect(playerPage.getByRole('log').getByText('Ainda tem vaga?')).toBeVisible();
  // The thread renders optimistically; wait for persistence before opening the GM's inbox.
  await expect(playerPage.getByText('Enviando…', { exact: true })).toHaveCount(0);

  // The GM sees it on the bell and in the inbox, and answers.
  const gmPage = gmSession.page;
  await gmPage.goto('/messages');
  await expect(gmPage.getByRole('main').getByText(/Ainda tem vaga\?/)).toBeVisible();
  await gmPage.getByRole('link', { name: new RegExp(`${player.username} Ainda tem vaga`) }).click();
  await gmPage.getByRole('textbox', { name: 'Mensagem' }).fill('Tem, sim. Pode pedir!');
  await gmPage.keyboard.press('Enter');
  await expect(gmPage.getByRole('log').getByText('Tem, sim. Pode pedir!')).toBeVisible();

  // The answer reaches the player without a reload (the thread polls).
  await expect(playerPage.getByRole('log').getByText('Tem, sim. Pode pedir!')).toBeVisible({
    timeout: 15_000,
  });

  // After joining: the table chat, a group in the same inbox.
  await playerPage.goto(`/tables/${slug}`);
  await playerPage.getByRole('button', { name: 'Pegar vaga' }).click();
  await expect(playerPage.getByText('Você está nesta mesa.')).toBeVisible();
  await playerPage.getByRole('link', { name: 'Chat da mesa' }).click();
  await expect(playerPage).toHaveURL(/\/messages\/[0-9a-f-]+/);
  await playerPage.getByRole('textbox', { name: 'Mensagem' }).fill('Cheguei!');
  await playerPage.keyboard.press('Enter');
  await expect(playerPage.getByRole('log').getByText('Cheguei!')).toBeVisible();

  // The full-page chat stays separate; the same conversations work in the drawer.
  await expect(playerPage.getByRole('button', { name: 'Abrir chat' })).toHaveCount(0);
  for (const width of [390, 1280]) {
    await playerPage.setViewportSize({ width, height: 800 });
    await playerPage.goto('/');
    const trigger = playerPage.getByRole('button', { name: 'Abrir chat' });
    await trigger.click();
    const drawer = playerPage.getByRole('dialog', { name: 'Mensagens' });
    await drawer.getByRole('link', { name: new RegExp(title) }).click();
    await expect(drawer.getByRole('textbox', { name: 'Mensagem' })).toBeVisible();
    await drawer.getByRole('textbox', { name: 'Mensagem' }).fill(`Drawer ${width} `);
    await drawer.getByRole('button', { name: 'Escolher emoji' }).click();
    await drawer.getByRole('combobox', { name: 'Procurar' }).fill('dado');
    await drawer.getByRole('option', { name: /dado/ }).first().click();
    await playerPage.keyboard.press('Enter');
    await expect(drawer.getByRole('log').getByText(`Drawer ${width} 🎲`)).toBeVisible();
    await expect(drawer.getByText('Enviando…', { exact: true })).toHaveCount(0);
    expect(await drawer.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    await playerPage.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
  }

  expect(errors).toEqual([]);
  await playerSession.context.close();
  await gmSession.context.close();
});

test('turning direct messages off hides "Falar com o mestre"', async ({ browser }) => {
  const gm = await createUser('Mestre Caio');
  const gmSession = await asUser(browser, gm);
  const slug = await createTable(gmSession.page, { title: uniqueTitle('Mesa') });

  await gmSession.page.goto('/account/profile');
  await gmSession.page.getByText('Receber mensagens diretas', { exact: true }).click();
  await expect(gmSession.page.getByText('Preferência salva.')).toBeVisible();

  const player = await createUser('Duda');
  const playerSession = await asUser(browser, player);
  await playerSession.page.goto(`/tables/${slug}`);
  await expect(
    playerSession.page.getByText('O mestre não recebe mensagens diretas agora.'),
  ).toBeVisible();
  await expect(
    playerSession.page.getByRole('button', { name: 'Falar com o mestre' }),
  ).toBeDisabled();

  await playerSession.context.close();
  await gmSession.context.close();
});
