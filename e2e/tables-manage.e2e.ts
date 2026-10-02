import { expect, test } from '@playwright/test';
import {
  PNG,
  chooseFromMenu,
  pageMenu,
  createTable,
  pickImage,
  pickFromSearch,
  setFirstSession,
  signIn,
  uniqueTitle,
} from './support/app';
import { createUser, database } from './support/users';

// A signed-in GM creating and managing tables, against the local Supabase.
test.skip(({ isMobile }) => isMobile, 'signed-in flows run on desktop only');

test.describe('rich text', () => {
  test('is formatted, saved as HTML and shown formatted, and the editor adds no CSP violation', async ({
    page,
  }) => {
    // What the page reports; the editor is judged by what appears after it is ready, since other
    // controls on this page also report during hydration.
    await page.addInitScript(() =>
      document.addEventListener('securitypolicyviolation', (event) =>
        ((window as Window & { __violations?: string[] }).__violations ??= []).push(
          `${event.violatedDirective} ${event.sourceFile}:${event.lineNumber} ${event.sample}`,
        ),
      ),
    );
    const violations = () =>
      page.evaluate(() => (window as Window & { __violations?: string[] }).__violations ?? []);
    const gm = await createUser('Mestra Rich');
    await signIn(page, gm);
    await page.goto('/tables/new');
    await pickFromSearch(page, 'Sistema de RPG', 'Daggerheart');
    await page.getByLabel('Título').fill(uniqueTitle('Com formatação'));
    await setFirstSession(page, '2099-06-01T19:00');

    const description = page.getByLabel('Descrição');
    await expect(page.getByRole('toolbar').first()).toBeVisible();
    const before = await violations();
    await description.click();
    await page.getByRole('button', { name: 'Negrito' }).first().click();
    await page.keyboard.type('Regras da casa');
    await page.getByRole('button', { name: 'Negrito' }).first().click();
    await page.getByRole('button', { name: 'Lista com marcadores' }).first().click();
    await page.keyboard.type(' sem reviver');
    // Before the submit: the next page is a new document, with its own report.
    expect((await violations()).slice(before.length)).toEqual([]);
    await page.getByRole('button', { name: 'Abrir mesa' }).click();
    await expect(page).toHaveURL(/\/tables\/[^/]+$/);

    await expect(page.locator('.rich-text strong', { hasText: 'Regras da casa' })).toBeVisible();
    await expect(page.locator('.rich-text li', { hasText: 'sem reviver' })).toBeVisible();
  });
});

test.describe('creating a table', () => {
  test('a signed-in user opens a table and sees it live at its own address (the M1 goal)', async ({
    page,
    browser,
  }) => {
    const gm = await createUser('Mestra Ana');
    const title = uniqueTitle('Mesa do Lich');
    await signIn(page, gm);

    const slug = await createTable(page, { title, description: 'Uma noite só. Traga dados.' });

    // The address is made from the title, in English path, no numeric id.
    expect(slug).toMatch(/^mesa-do-lich-[a-z0-9]+$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(page.getByRole('main').getByText(gm.username)).toBeVisible();
    await expect(page.getByText('5 vagas restantes').first()).toBeVisible();
    await expect(page.getByText('Você mestra esta mesa.')).toBeVisible();

    // An anonymous visitor sees the same table, at the same address, in the list too.
    const visitor = await browser.newContext();
    const anon = await visitor.newPage();
    await anon.goto(`/tables/${slug}`);
    await expect(anon.getByRole('heading', { level: 1 })).toHaveText(title);
    await anon.goto('/tables');
    await expect(anon.getByRole('link', { name: title })).toBeVisible();
    await visitor.close();
  });

  test('two tables with the same title get different addresses', async ({ page }) => {
    const gm = await createUser('Mestre Beto');
    const title = uniqueTitle('Repetida');
    await signIn(page, gm);

    const first = await createTable(page, { title });
    const second = await createTable(page, { title });

    expect(second).toBe(`${first}-2`);
  });

  test('refuses a title that is too short, saying so and keeping what was typed', async ({
    page,
  }) => {
    const gm = await createUser('Mestra Cris');
    await signIn(page, gm);

    await page.goto('/tables/new');
    await pickFromSearch(page, 'Sistema de RPG', 'Daggerheart');
    await page.getByLabel('Título').fill('ab');
    await page.getByLabel('Descrição').fill('Isto deve continuar aqui.');
    await setFirstSession(page, '2099-06-01T19:00');
    // The browser's own minlength would stop it first; turn that off to reach the server's check.
    await page.getByLabel('Título').evaluate((el) => el.removeAttribute('minlength'));
    await page.getByRole('button', { name: 'Abrir mesa' }).click();

    await expect(page.getByText('Corrija os campos marcados.')).toBeVisible();
    await expect(page.getByLabel('Título')).toHaveValue('ab');
    // A rich-text editor, not an input: its text, not a value.
    await expect(page.getByLabel('Descrição')).toHaveText('Isto deve continuar aqui.');
    await expect(page).toHaveURL(/tables\/new$/);
  });

  test('a first session in the past cannot be picked', async ({ page }) => {
    const gm = await createUser('Mestre Davi');
    await signIn(page, gm);

    await page.goto('/tables/new');
    await pickFromSearch(page, 'Sistema de RPG', 'Daggerheart');
    await page.getByLabel('Título').fill(uniqueTitle('Passada'));
    // The calendar starts at today; a past day typed in is not taken. (The server refuses one
    // too: see write.spec.ts, "in_the_past".)
    await page.getByLabel('Primeira sessão', { exact: true }).fill('01/01/2020');
    await page.keyboard.press('Enter');

    await expect
      .poll(() => page.locator('input[name="startsAtLocal"]').inputValue())
      .not.toMatch(/^2020-/);
  });

  test('a campaign asks how often it repeats', async ({ page }) => {
    const gm = await createUser('Mestra Eva');
    await signIn(page, gm);
    await page.goto('/tables/new');

    await expect(page.getByLabel('Repete')).toHaveCount(0);
    await page.getByLabel('Campanha (várias sessões)').check();

    await expect(page.getByLabel('Repete')).toBeVisible();
    await expect(page.getByLabel('Última sessão até', { exact: true })).toBeVisible();
  });
});

test.describe('the welcome message', () => {
  const welcomeOf = async (slug: string) => {
    const sql = database();
    try {
      const [row] = await sql`select welcome_message from game_tables where slug = ${slug}`;
      return row.welcome_message as string | null;
    } finally {
      await sql.end();
    }
  };

  test('every new table starts with the friendly default, token and all', async ({ page }) => {
    const gm = await createUser('Mestra Lara');
    await signIn(page, gm);
    await page.goto('/tables/new');

    const field = page.getByLabel('Mensagem de boas-vindas');
    await expect(field).toHaveText(
      /Olá, aventureiro\(a\)! Que alegria ter você na mesa '\{nome da mesa\}'!/,
    );
    await expect(field).toHaveText(/WhatsApp: \(##\) #####-##### \. Até breve!/);
  });

  test('is kept as written, edited later, and cleared for good', async ({ page }) => {
    const gm = await createUser('Mestre Wagner');
    await signIn(page, gm);
    const slug = await createTable(page, { title: uniqueTitle('Com boas-vindas') });
    expect(await welcomeOf(slug)).toContain("na mesa '{nome da mesa}'");

    await chooseFromMenu(page, 'Editar');
    const field = page.getByLabel('Mensagem de boas-vindas');
    await expect(field).toHaveText(/WhatsApp/);
    await field.fill('Bem-vinda! Me chama no (11) 90000-0000.');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page).toHaveURL(new RegExp(`/tables/${slug}/manage$`));
    expect(await welcomeOf(slug)).toBe('<p>Bem-vinda! Me chama no (11) 90000-0000.</p>');

    // Saving other changes keeps it.
    await page.goto(`/tables/${slug}/edit`);
    await page.getByLabel('Título').fill('Renomeada');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page).toHaveURL(new RegExp(`/tables/${slug}/manage$`));
    expect(await welcomeOf(slug)).toBe('<p>Bem-vinda! Me chama no (11) 90000-0000.</p>');

    // Emptying it means no message, not the default again.
    await page.goto(`/tables/${slug}/edit`);
    await page.getByLabel('Mensagem de boas-vindas').fill('');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page).toHaveURL(new RegExp(`/tables/${slug}/manage$`));
    expect(await welcomeOf(slug)).toBeNull();
    await page.goto(`/tables/${slug}/edit`);
    await expect(page.getByLabel('Mensagem de boas-vindas')).toHaveText('');
  });

  test('is never shown on the public table page', async ({ page, browser }) => {
    const gm = await createUser('Mestra Nina');
    await signIn(page, gm);
    await page.goto('/tables/new');
    await pickFromSearch(page, 'Sistema de RPG', 'Daggerheart');
    await page.getByLabel('Título').fill(uniqueTitle('Privada'));
    await setFirstSession(page, '2099-06-01T19:00');
    await page.getByLabel('Mensagem de boas-vindas').fill('Segredo só para quem entrar.');
    await page.getByRole('button', { name: 'Abrir mesa' }).click();
    await expect(page).toHaveURL(/\/tables\/[^/]+$/);

    const visitor = await browser.newContext();
    const anon = await visitor.newPage();
    await anon.goto(page.url());
    await expect(anon.getByText('Segredo só para quem entrar.')).toHaveCount(0);
    await visitor.close();
  });

  test('a message over the limit is refused, and what was typed stays', async ({ page }) => {
    const gm = await createUser('Mestre Otto');
    await signIn(page, gm);
    await page.goto('/tables/new');

    await pickFromSearch(page, 'Sistema de RPG', 'Daggerheart');
    await page.getByLabel('Título').fill(uniqueTitle('Longa'));
    await setFirstSession(page, '2099-06-01T19:00');
    const field = page.getByLabel('Mensagem de boas-vindas');
    // The editor does not stop the typing: it counts what is seen and the server refuses the excess.
    await field.fill('x'.repeat(1001));
    await page.getByRole('button', { name: 'Abrir mesa' }).click();

    await expect(page.getByText('Corrija os campos marcados.')).toBeVisible();
    await expect(field).toHaveText('x'.repeat(1001));
    await expect(page).toHaveURL(/tables\/new$/);
  });
});

test.describe('images', () => {
  test('uploads a picture to Storage and keeps its path on the table', async ({
    page,
    request,
  }) => {
    const gm = await createUser('Mestra Fernanda');
    await signIn(page, gm);

    const slug = await createTable(page, {
      title: uniqueTitle('Com imagem'),
      image: { name: 'capa.png', mimeType: 'image/png', buffer: PNG },
    });

    const sql = database();
    try {
      const [row] = await sql`select image_path from game_tables where slug = ${slug}`;
      // The crop step sends its own file, so the type is whatever it drew (WebP).
      expect(row.image_path).toMatch(/^tables\/[0-9a-f-]{36}\.(png|webp)$/);

      // The file is really in the bucket, publicly readable.
      const url = `${process.env.E2E_API_URL ?? 'http://127.0.0.1:54341'}/storage/v1/object/public/table-images/${row.image_path}`;
      const stored = await request.get(url);
      expect(stored.status()).toBe(200);
      expect(stored.headers()['content-type']).toMatch(/image\/(png|webp)/);
    } finally {
      await sql.end();
    }
  });

  test('refuses a file that only pretends to be an image, and creates no table', async ({
    page,
  }) => {
    const gm = await createUser('Mestre Gil');
    const title = uniqueTitle('Falsa imagem');
    await signIn(page, gm);

    await page.goto('/tables/new');
    await pickFromSearch(page, 'Sistema de RPG', 'Daggerheart');
    await page.getByLabel('Título').fill(title);
    await setFirstSession(page, '2099-06-01T19:00');
    await pickImage(page, {
      name: 'capa.png',
      mimeType: 'image/png',
      buffer: Buffer.from('<script>alert(1)</script>'),
    });
    await page.getByRole('button', { name: 'Abrir mesa' }).click();

    await expect(page.getByText('Use uma imagem PNG, JPEG ou WebP.')).toBeVisible();
    const sql = database();
    try {
      expect(await sql`select 1 from game_tables where title = ${title}`).toHaveLength(0);
    } finally {
      await sql.end();
    }
  });
});

test.describe('editing and disabling', () => {
  test('the GM renames a table and its address stays', async ({ page }) => {
    const gm = await createUser('Mestra Helena');
    await signIn(page, gm);
    const slug = await createTable(page, { title: uniqueTitle('Nome antigo') });

    await chooseFromMenu(page, 'Editar');
    await expect(page).toHaveURL(new RegExp(`/tables/${slug}/edit$`));
    await expect(
      page.getByText(/quem já está na mesa recebe o convite do calendário/),
    ).toBeVisible();
    await page.getByLabel('Título').fill('Nome novo');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();

    // Saving goes back to the manage page, which says so.
    await expect(page).toHaveURL(new RegExp(`/tables/${slug}/manage$`));
    await expect(page.getByText('Mesa salva.')).toBeVisible();
    await page.goto(`/tables/${slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nome novo');
  });

  test('another member cannot edit it, and is not offered the link', async ({ page, browser }) => {
    const gm = await createUser('Mestre Igor');
    const other = await createUser('Jogadora Julia');
    await signIn(page, gm);
    const slug = await createTable(page, { title: uniqueTitle('Só do Igor') });

    const context = await browser.newContext();
    const otherPage = await context.newPage();
    await signIn(otherPage, other);
    await otherPage.goto(`/tables/${slug}`);
    await pageMenu(otherPage).click();
    await expect(otherPage.getByRole('menuitem', { name: 'Editar' })).toHaveCount(0);

    const response = await otherPage.goto(`/tables/${slug}/edit`);
    expect(response?.status()).toBe(403);
    await context.close();
  });

  test('an admin can edit any table', async ({ page, browser }) => {
    const gm = await createUser('Mestra Kátia');
    const admin = await createUser('Admin Lucas', { role: 'admin' });
    await signIn(page, gm);
    const slug = await createTable(page, { title: uniqueTitle('Da Kátia') });

    const context = await browser.newContext();
    const adminPage = await context.newPage();
    await signIn(adminPage, admin);
    await adminPage.goto(`/tables/${slug}`);
    await chooseFromMenu(adminPage, 'Editar');
    await adminPage.getByLabel('Título').fill('Editada pelo admin');
    await adminPage.getByRole('button', { name: 'Salvar alterações' }).click();

    await expect(adminPage).toHaveURL(new RegExp(`/tables/${slug}/manage$`));
    await adminPage.goto(`/tables/${slug}`);
    await expect(adminPage.getByRole('heading', { level: 1 })).toHaveText('Editada pelo admin');
    await context.close();
  });

  test('disabling takes a table off the public pages, and its address answers 404', async ({
    page,
    browser,
  }) => {
    const gm = await createUser('Mestre Marcos');
    const title = uniqueTitle('Vai sumir');
    await signIn(page, gm);
    const slug = await createTable(page, { title });

    await page.goto(`/tables/${slug}/edit`);
    // It asks first; only the dialog's button disables.
    await chooseFromMenu(page, 'Desativar mesa…');
    const dialog = page.getByRole('alertdialog', { name: 'Desativar esta mesa?' });
    await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Desativar mesa' }).click();
    await expect(page).toHaveURL(/\/tables$/);
    await expect(page.getByRole('link', { name: title })).toHaveCount(0);

    const visitor = await browser.newContext();
    const anon = await visitor.newPage();
    const response = await anon.goto(`/tables/${slug}`);
    expect(response?.status()).toBe(404);
    await visitor.close();

    // The GM still finds it on their dashboard, with no table status: those are for admin.
    await page.goto('/account/tables');
    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByText('Mesa desativada')).toHaveCount(0);
  });
});
