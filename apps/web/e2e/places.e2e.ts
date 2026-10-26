import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { signIn } from './support/app';
import { createUser, database } from './support/users';

// "Onde jogar" ships behind `api_directory_places`, which is off here (no GrowthBook): its public
// pages answer 404 and no menu links them, while the admin queue already works so places can be
// reviewed before the directory opens.

test('the places directory stays closed while its flag is off', async ({ page, request }) => {
  const sql = database();
  const slug = `lugar-${randomUUID().slice(0, 8)}`;
  try {
    const submitter = await createUser('Places Member');
    await sql`insert into places (slug, name, kind, postal_code, street, city, state, submitter_id, approved_at)
      values (${slug}, ${slug}, 'game_cafe', '51020000', 'Rua 1', 'Recife', 'PE', ${submitter.id}, now())`;

    for (const path of ['/places', `/pp/${slug}`, '/pp/new', `/pp/${slug}/claim`])
      expect((await request.get(path)).status(), path).toBe(404);
    expect((await request.get('/sitemap-places.xml')).status()).toBe(404);
    expect(await (await request.get('/sitemap-pages.xml')).text()).not.toContain('/places');

    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Onde jogar' })).toHaveCount(0);
  } finally {
    await sql`delete from places where slug = ${slug}`;
    await sql.end();
  }
});

test('an admin approves a place from the queue while the directory is off', async ({ page }) => {
  const sql = database();
  const name = `Taverna ${randomUUID().slice(0, 8)}`;
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  const admin = await createUser('Places Admin', { role: 'admin' });
  try {
    await sql`insert into places (slug, name, kind, postal_code, street, city, state, submitter_id)
      values (${slug}, ${name}, 'game_cafe', '51020000', 'Rua 1', 'Recife', 'PE', ${admin.id})`;
    await signIn(page, admin, `/admin/places?q=${encodeURIComponent(name)}`);
    await expect(page.getByRole('heading', { name: 'Lugares', level: 1 })).toBeVisible();
    await page
      .getByRole('button', { name: `Mais ações: ${name}` })
      .locator('visible=true')
      .click();
    await page.getByRole('menuitem', { name: 'Aprovar' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Aprovar' }).click();
    await expect(page.getByText('Lugar aprovado.')).toBeVisible();
    const [row] = await sql`select approved_at from places where slug = ${slug}`;
    expect(row.approved_at).not.toBeNull();

    // The claims queue opens from the list, empty for this place.
    await page.goto('/admin/places/claims?status=all');
    await expect(page.getByRole('heading', { name: 'Reivindicações', level: 1 })).toBeVisible();
    await expect(page.getByText(name)).toHaveCount(0);
  } finally {
    await sql`delete from places where slug = ${slug}`;
    await sql.end();
  }
});
