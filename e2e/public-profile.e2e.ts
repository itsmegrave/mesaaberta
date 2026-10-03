import { expect, test } from '@playwright/test';
import { createUser, database, type TestUser } from './support/users';
import { signIn } from './support/app';

let gm: TestUser;
let slugs: string[];
test.beforeAll(async () => {
  gm = await createUser('Perfil Publico');
  const sql = database();
  try {
    await sql`update profiles set name = 'Private legal name', city = 'Private city', avatar_url = null where id = ${gm.id}`;
    await sql`insert into profile_social_links (profile_id, network, url, position) values (${gm.id}, 'instagram', 'https://instagram.com/mesaaberta', 0), (${gm.id}, 'website', 'https://example.com/', 1)`;
    slugs = Array.from({ length: 13 }, (_, n) => `${gm.username}-table-${n}`);
    for (const [n, slug] of slugs.entries()) {
      await sql`insert into game_tables (slug, title, system_id, gm_id, kind, capacity, starts_at, duration_minutes, timezone, join_details, welcome_message) values (${slug}, ${`Mesa pública ${n}`}, (select id from systems where slug = 'daggerheart'), ${gm.id}, 'one_shot', 4, ${new Date(Date.now() + (n + 2) * 86400000)}, 180, 'America/Sao_Paulo', 'Private join link', 'Private welcome message')`;
    }
  } finally {
    await sql.end();
  }
});

test('anonymous direct entry renders identity, safe social links and cards without private data', async ({
  page,
  request,
}) => {
  const response = await request.get(`/u/${gm.username}`);
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toContain('no-store');
  const html = await response.text();
  expect(html).toContain(`@${gm.username}`);
  for (const privateText of [
    'Private legal name',
    'Private city',
    gm.email,
    'Private join link',
    'Private welcome message',
  ])
    expect(html).not.toContain(privateText);

  await page.goto(`/u/${gm.username}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`@${gm.username}`);
  const breadcrumbs = page.getByRole('navigation', { name: 'Trilha de navegação' });
  await expect(breadcrumbs).toBeVisible();
  await expect(breadcrumbs.getByRole('link', { name: 'Início' })).toHaveAttribute('href', '/');
  await expect(breadcrumbs.getByText(`@${gm.username}`)).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('link', { name: /^Voltar/ })).toHaveCount(0);
  await expect(page.getByText('Novo mestre')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Editar perfil' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Abrir Instagram em nova aba' })).toHaveAttribute(
    'href',
    'https://instagram.com/mesaaberta',
  );
  await expect(page.getByRole('link', { name: 'Abrir Site em nova aba' })).toHaveAttribute(
    'rel',
    'noopener noreferrer',
  );
  await expect(page.locator('main article')).toHaveCount(12);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('pagination and the profile work without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto(`/u/${gm.username}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`@${gm.username}`);
    await page.getByRole('link', { name: 'Próxima página' }).click();
    await expect(page).toHaveURL(new RegExp(`/u/${gm.username}\\?page=2$`));
    await expect(page.locator('main article')).toHaveCount(1);
    await page.getByRole('link', { name: 'Página anterior' }).click();
    await expect(page.locator('main article')).toHaveCount(12);
  } finally {
    await context.close();
  }
});

test('capitalization redirects to the canonical username and static routes remain available', async ({
  request,
}) => {
  const response = await request.get(`/u/${gm.username.toUpperCase()}`, { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(new URL(response.headers().location, response.url()).pathname).toBe(`/u/${gm.username}`);
  for (const path of ['/tables', '/privacy', '/terms', '/favicon.ico'])
    expect((await request.get(path)).status()).toBe(200);
  expect((await request.get(`/u/${gm.username}?page=99`)).status()).toBe(404);
  expect((await request.get('/u/no-such-public-profile')).status()).toBe(404);
});

test('the table links to its GM, and the public page offers its owner an edit action and a visitor view', async ({
  page,
  isMobile,
}) => {
  await page.goto(`/tables/${slugs[0]}`);
  await page.getByRole('link', { name: `@${gm.username}`, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`@${gm.username}`);
  if (isMobile) return;
  await signIn(page, gm, `/u/${gm.username}`);
  await expect(page.getByRole('link', { name: 'Editar perfil' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Mandar mensagem para @/ })).toHaveCount(0);

  // "Ver como visitante": the owner's action gives way to the visitor's.
  await page.getByRole('button', { name: `Mais ações: @${gm.username}` }).click();
  await page.getByRole('menuitem', { name: 'Ver como visitante' }).click();
  await expect(page.getByRole('link', { name: 'Editar perfil' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Mandar mensagem para @/ })).toBeVisible();
  await page.getByRole('link', { name: 'Voltar ao meu perfil' }).click();
  await page.getByRole('link', { name: 'Editar perfil' }).click();
  await expect(page).toHaveURL(/\/account\/profile$/);
});

test('profiles without tables render, and suspension and rename invalidate direct entry', async ({
  page,
  request,
}) => {
  const user = await createUser('Sem Mesas Publicas');
  const sql = database();
  try {
    await page.goto(`/u/${user.username}`);
    await expect(page.getByText('Nenhuma próxima mesa por aqui.')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Redes sociais e site' })).toHaveCount(0);
    const renamed = `${user.username}-new`;
    await sql`update profiles set username = ${renamed} where id = ${user.id}`;
    expect((await request.get(`/u/${user.username}`)).status()).toBe(404);
    expect((await request.get(`/u/${renamed}`)).status()).toBe(200);
    await sql`update profiles set status = 'suspended' where id = ${user.id}`;
    expect((await request.get(`/u/${renamed}`)).status()).toBe(404);
    await sql`update profiles set username = null where id = ${user.id}`;
    expect((await request.get(`/u/${renamed}`)).status()).toBe(404);
  } finally {
    await sql.end();
  }
});

test('long handles and all social icons remain usable at narrow widths and in both themes', async ({
  page,
}) => {
  const user = await createUser('Redes Publicas');
  const handle = `long-${user.id.replace(/-/g, '').slice(0, 25)}`;
  const networks = [
    'instagram',
    'x',
    'bluesky',
    'facebook',
    'tiktok',
    'youtube',
    'twitch',
    'discord',
    'github',
    'linkedin',
  ];
  const sql = database();
  try {
    await sql`update profiles set username = ${handle} where id = ${user.id}`;
    for (const [position, network] of networks.entries())
      await sql`insert into profile_social_links (profile_id, network, url, position) values (${user.id}, ${network}, 'https://example.com/', ${position})`;
  } finally {
    await sql.end();
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(`/u/${handle}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`@${handle}`);
  await expect(
    page.getByRole('list', { name: 'Redes sociais e site' }).locator('a svg'),
  ).toHaveCount(10);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: test.info().outputPath('public-profile-mobile.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: /tema/i }).click();
  const social = page.getByRole('list', { name: 'Redes sociais e site' }).locator('a').first();
  await social.focus();
  await expect(social).toBeFocused();
  const headingColor = await page
    .getByRole('heading', { level: 1 })
    .evaluate((element) => getComputedStyle(element).color);
  await expect(social).toHaveCSS('color', headingColor);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: test.info().outputPath('public-profile-mobile-theme.png'),
    fullPage: true,
  });
  for (const width of [375, 640, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.screenshot({
    path: test.info().outputPath('public-profile-desktop.png'),
    fullPage: true,
  });
});
