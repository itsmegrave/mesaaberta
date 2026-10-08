import { expect, test } from '@playwright/test';

// Like the table list, the crowdfunding list is for anyone: no sign-in to read it.
test.describe('crowdfunding list, anonymous', () => {
  test('opens without sending the visitor to sign in', async ({ page }) => {
    await page.goto('/crowdfunding');

    await expect(page).toHaveURL(/\/crowdfunding$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Financiamentos coletivos' }),
    ).toBeVisible();
  });

  test('offers to add one, and asks to sign in only then', async ({ page }) => {
    await page.goto('/crowdfunding');

    await page.getByRole('link', { name: 'Adicionar financiamento' }).click();

    await expect(page).toHaveURL(/\/login\?next=%2Fcrowdfunding%2Fnew/);
  });

  test('the link reader, which fetches addresses for a member, refuses a visitor', async ({
    request,
  }) => {
    const reader = await request.get('/crowdfunding/preview?url=https://catarse.me/x', {
      maxRedirects: 0,
    });

    expect(reader.status()).toBe(401);
  });
});

// Exercises the actual Worker loaders with no profile to join for the submitter.
test('automatic campaigns are visible, credited and reportable without a member submitter', async ({
  page,
}) => {
  const { randomUUID } = await import('node:crypto');
  const { createUser, database } = await import('./support/users');
  const { signIn } = await import('./support/app');
  const db = database(),
    id = randomUUID(),
    name = `Importado RPG ${id}`;
  try {
    await db`insert into crowdfundings (id,url,platform,name,owner,starts_on,ends_on,origin,import_source) values (${id},${`https://meeplestarter.com.br/${id}`},'meeplestarter',${name},'Editora',current_date,current_date+30,'import','meeplestarter')`;
    await page.goto(`/crowdfunding?q=${encodeURIComponent(name)}`);
    await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible();
    await expect(
      page.getByText('Importado automaticamente do Meeplestarter', { exact: true }),
    ).toBeVisible();
    const admin = await createUser('Import Admin', { role: 'admin' });
    await signIn(page, admin, `/crowdfunding?q=${encodeURIComponent(name)}`);
    await expect(page.getByRole('button', { name: `Denunciar ${name}` })).toBeVisible();
    await page.goto(`/admin/crowdfunding?q=${encodeURIComponent(name)}`);
    await expect(
      page
        .getByText('Importado automaticamente do Meeplestarter', { exact: false })
        .locator('visible=true'),
    ).toBeVisible();
  } finally {
    await db`delete from crowdfundings where id=${id}`;
    await db.end();
  }
});
