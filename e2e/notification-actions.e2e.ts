import { expect, test } from '@playwright/test';
import { signIn } from './support/app';
import { createUser, database } from './support/users';

for (const javaScriptEnabled of [true, false]) {
  test(`notification actions mark read and follow links with JavaScript ${javaScriptEnabled ? 'enabled' : 'disabled'}`, async ({
    page,
    browser,
  }) => {
    const user = await createUser('Notificação Ações');
    const sql = database();
    try {
      for (const [title, link] of [
        ['Abrir destino', '/account/tables'],
        ['Ler uma', null],
        ['Ler todas', null],
      ]) {
        await sql`insert into notifications (recipient_id, category, type, title, link)
          values (${user.id}, 'table', 'table_updated', ${title}, ${link})`;
      }
    } finally {
      await sql.end();
    }
    await signIn(page, user, '/notifications?category=table');
    const context = await browser.newContext({
      storageState: await page.context().storageState(),
      javaScriptEnabled,
      viewport: page.viewportSize() ?? undefined,
    });
    try {
      const feed = await context.newPage();
      await feed.goto(
        new URL('/notifications?category=table', test.info().project.use.baseURL).href,
        {
          waitUntil: 'domcontentloaded',
        },
      );
      const main = feed.getByRole('main');
      const row = main.getByRole('listitem').filter({ hasText: 'Ler uma' });
      await row.getByRole('button', { name: 'Marcar como lida', exact: true }).click();
      await expect(row.getByRole('button', { name: 'Marcar como lida', exact: true })).toHaveCount(
        0,
      );
      await expect(feed).toHaveURL(/\/notifications\?category=table$/);
      await main.getByRole('button', { name: 'Abrir destino', exact: true }).click();
      await expect(feed).toHaveURL(/\/account\/tables$/);
      await feed.goto(
        new URL('/notifications?category=table', test.info().project.use.baseURL).href,
        {
          waitUntil: 'domcontentloaded',
        },
      );
      await feed
        .getByRole('main')
        .getByRole('button', { name: 'Marcar todas como lidas', exact: true })
        .click();
      await expect(
        feed
          .getByRole('main')
          .getByRole('button', { name: 'Marcar todas como lidas', exact: true }),
      ).toHaveCount(0);
      const db = database();
      try {
        const [{ unread }] =
          await db`select count(*)::int as unread from notifications where recipient_id = ${user.id} and read_at is null`;
        expect(unread).toBe(0);
      } finally {
        await db.end();
      }
    } finally {
      await context.close();
    }
  });
}
