import { expect, test } from '@playwright/test';
import { PNG, accountMenu, createTable, pickFromSearch, signIn, uniqueTitle } from './support/app';
import { createUser, database } from './support/users';

// The profile page: editing, the data export and closing the account. Against the local Supabase.
test.skip(({ isMobile }) => isMobile, 'signed-in flows run on desktop only');

test('the account menu leads to the profile, where the details are saved and the username stays', async ({
  page,
}) => {
  const user = await createUser('Perfil Editado');
  await signIn(page, user);

  await accountMenu(page, user.username).click();
  await page
    .getByRole('navigation', { name: 'Menu da conta' })
    .getByRole('link', { name: 'Perfil' })
    .click();
  await page.getByRole('link', { name: 'Editar perfil' }).click();
  await expect(page).toHaveURL(/\/u\/profile\/edit$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Seu perfil');

  // "Perfil público" first: the name, the bio and the links.
  await page.getByLabel(/^Bio/).fill('Mestro horror cósmico.\nSessão zero antes de tudo.');
  await page.getByRole('button', { name: 'Salvar perfil' }).click();
  await expect(page.getByText('Perfil salvo.')).toBeVisible();

  // Each part of the page saves on its own, without touching the others.
  const sections = page.getByRole('navigation', { name: 'Seções do perfil' });
  await sections.getByRole('link', { name: 'Sobre você' }).click();
  await expect(page).toHaveURL(/\/u\/profile\/edit\/about$/);
  await page.getByLabel('Cidade').fill('Recife');
  // The toast of the first save may still be up, so wait for this save's own answer.
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().includes('/u/profile/edit/about'),
  );
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await saved;
  await expect(page.getByText('Perfil salvo.').first()).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Cidade')).toHaveValue('Recife');
  await sections.getByRole('link', { name: 'Conta e acesso' }).click();
  await expect(page.getByRole('textbox', { name: 'Email' })).toHaveValue(user.email);
  await expect(page.getByLabel('Nome de usuário')).toHaveValue(user.username);
  await expect(page.getByLabel('Nome de usuário')).toHaveAttribute('readonly', '');

  // The bio is on the public page, line breaks and all; the city is not.
  await page.goto(`/u/${user.username}`);
  await expect(page.getByText('Sessão zero antes de tudo.')).toBeVisible();
  await expect(page.getByRole('main')).not.toContainText('Recife');
});

test("the timezone on the profile wins over the browser's, on every page", async ({
  page,
  isMobile,
}) => {
  const user = await createUser('Fuso Horario');
  await signIn(page, user, '/u/profile/edit/about');

  // Not picked yet: the field offers the browser's zone.
  // A phone shows it on the button that opens the sheet; a wide screen, in the box to type into.
  if (isMobile) {
    await expect(page.getByRole('button', { name: /^Fuso horário/ })).toContainText(
      'America/Sao Paulo',
    );
  } else {
    await expect(page.getByRole('combobox', { name: 'Fuso horário' })).toHaveValue(
      'America/Sao Paulo',
    );
  }

  await pickFromSearch(page, 'Fuso horário', 'Asia/Tokyo');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Perfil salvo.')).toBeVisible();

  await page.goto('/t/os-sinos-de-sablewood');
  await expect(page.getByRole('main')).toContainText('GMT+9');

  // A table they open is typed in that zone too: 19:00 in Tokyo, shown back as 19:00 GMT+9.
  await page.goto('/tables/new');
  await expect(page.getByText(/No seu fuso, Asia\/Tokyo \(GMT\+9\)/)).toBeVisible();
  await createTable(page, { title: uniqueTitle('Mesa em Tóquio') });
  await expect(page.getByRole('main')).toContainText(/19:00 GMT\+9/);
});

test('downloads a copy of the account data as JSON', async ({ page }) => {
  const user = await createUser('Dados Exportados');
  await signIn(page, user, '/u/profile/edit/data');

  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Baixar meus dados' }).click();
  const file = await download;

  expect(file.suggestedFilename()).toMatch(/^mesa-aberta-dados-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(
    await (await file.createReadStream()).toArray().then((c) => Buffer.concat(c).toString()),
  );
  expect(data.account).toEqual({ id: user.id, email: user.email });
  expect(data.profile.username).toBe(user.username);
});

test('closing the account asks for the username, then removes the person and signs them out', async ({
  page,
}) => {
  const user = await createUser('Conta Apagada');
  await signIn(page, user, '/u/profile/edit/data');

  let posts = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('?/delete')) posts++;
  });

  // A wrong @usuário is caught before anything is sent.
  await page.getByLabel('Digite seu @usuário para confirmar').fill('outra-pessoa');
  await page.getByRole('button', { name: 'Apagar minha conta' }).click();
  await expect(page.getByRole('alert')).toContainText('O @usuário digitado não confere.');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);

  // The right one opens a dialog that asks once more; "Cancelar" sends nothing.
  await page.getByLabel('Digite seu @usuário para confirmar').fill(user.username);
  await page.getByRole('button', { name: 'Apagar minha conta' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Apagar sua conta?' });
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).toHaveCount(0);
  expect(posts).toBe(0);

  await page.getByRole('button', { name: 'Apagar minha conta' }).click();
  await dialog.getByRole('button', { name: 'Apagar minha conta' }).click();
  await expect(page).toHaveURL(/localhost:\d+\/$/);
  await expect(accountMenu(page, user.username)).toHaveCount(0);

  const sql = database();
  try {
    const [profile] = await sql`select username, name from profiles where id = ${user.id}`;
    expect(profile).toEqual({ username: null, name: null });
    const [auth] = await sql`select count(*)::int as n from auth.users where id = ${user.id}`;
    expect(auth.n).toBe(0);
  } finally {
    await sql.end();
  }
});

test('uploads a profile picture to the own folder, shows it in the header, and removes it', async ({
  page,
}) => {
  const user = await createUser('Foto Enviada');
  await signIn(page, user, '/u/profile/edit');
  await expect(page.getByRole('button', { name: 'Remover foto enviada' })).toHaveCount(0);

  // The button opens a dialog with the drop zone; the picture is framed there, and using the crop
  // sends it.
  await page.getByRole('button', { name: 'Alterar foto de perfil' }).click();
  const dialog = page.getByRole('dialog', { name: 'Editar foto de perfil' });
  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'eu.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await page.getByRole('button', { name: 'Aproximar' }).click();
  await page.getByRole('button', { name: 'Usar este recorte' }).click();
  await expect(page.getByText('Foto atualizada.')).toBeVisible();

  const sql = database();
  try {
    const [{ avatar_path: path }] =
      await sql`select avatar_path from profiles where id = ${user.id}`;
    expect(path).toMatch(new RegExp(`^${user.id}/[0-9a-f-]+\\.(png|webp|jpg)$`));
    await expect(
      accountMenu(page, user.username).locator(`img[src$="/profile-avatars/${path}"]`),
    ).toHaveCount(1);

    await page.getByRole('button', { name: 'Remover foto enviada' }).click();
    await expect(page.getByText('Foto removida.', { exact: false })).toBeVisible();
    const [after] = await sql`select avatar_path from profiles where id = ${user.id}`;
    expect(after.avatar_path).toBeNull();
    const [file] =
      await sql`select count(*)::int as n from storage.objects where bucket_id = 'profile-avatars' and name = ${path}`;
    expect(file.n).toBe(0);
  } finally {
    await sql.end();
  }
});

test('uploads a cover in 4:1, shows it on the public profile, and removes it', async ({ page }) => {
  const user = await createUser('Capa Enviada');
  await signIn(page, user, '/u/profile/edit');
  await expect(page.getByText('Sem capa por enquanto')).toBeVisible();

  await page.getByRole('button', { name: 'Alterar capa' }).click();
  await page
    .getByRole('dialog', { name: 'Editar capa' })
    .locator('input[type="file"]')
    .setInputFiles({ name: 'capa.png', mimeType: 'image/png', buffer: PNG });
  await page.getByRole('button', { name: 'Usar este recorte' }).click();
  await expect(page.getByText('Capa atualizada.')).toBeVisible();

  const sql = database();
  try {
    const [{ banner_path: path }] =
      await sql`select banner_path from profiles where id = ${user.id}`;
    expect(path).toMatch(new RegExp(`^${user.id}/banners/[0-9a-f-]+\\.(png|webp|jpg)$`));

    await page.goto(`/u/${user.username}`);
    await expect(page.locator(`img[src$="/profile-avatars/${path}"]`)).toHaveCount(1);

    await page.goto('/u/profile/edit');
    await page.getByRole('button', { name: 'Remover capa' }).click();
    await expect(page.getByText('Capa removida.')).toBeVisible();
    const [after] = await sql`select banner_path from profiles where id = ${user.id}`;
    expect(after.banner_path).toBeNull();
  } finally {
    await sql.end();
  }
});

test('refuses a file that is not a picture', async ({ page }) => {
  const user = await createUser('Foto Falsa');
  await signIn(page, user, '/u/profile/edit');

  await page.getByRole('button', { name: 'Alterar foto de perfil' }).click();
  await page
    .getByRole('dialog', { name: 'Editar foto de perfil' })
    .locator('input[type="file"]')
    .setInputFiles({
      name: 'eu.png',
      mimeType: 'image/png',
      buffer: Buffer.from('<svg onload="alert(1)"></svg>'),
    });
  await expect(page.getByRole('alert')).toContainText('Envie uma foto PNG, JPEG ou WebP.');
});

test('a slow submit locks its button: it says it is busy, and a second click sends nothing', async ({
  page,
}) => {
  const user = await createUser('Envio Lento');
  await signIn(page, user, '/u/profile/edit/data');

  // Hold the answer, so the submit stays in flight while the test looks at the button.
  let posts = 0;
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/u/profile/edit/data?/delete', async (route) => {
    posts++;
    await held;
    await route.continue();
  });

  await page.getByLabel('Digite seu @usuário para confirmar').fill(user.username);
  const submit = page.locator('form[action="?/delete"]').getByRole('button', {
    name: 'Apagar minha conta',
  });
  await submit.click();
  await page
    .getByRole('alertdialog', { name: 'Apagar sua conta?' })
    .getByRole('button', { name: 'Apagar minha conta' })
    .click();

  await expect(submit).toHaveAttribute('aria-busy', 'true');
  await expect(submit).toHaveAttribute('aria-disabled', 'true');
  // A DOM click: Playwright itself will not click an aria-disabled button, just as a person cannot.
  await submit.evaluate((button: HTMLButtonElement) => button.click());

  release();
  await expect(page).toHaveURL(/localhost:\d+\/$/);
  expect(posts).toBe(1);
});
