import { expect, test } from '@playwright/test';
import { asUser, uniqueTitle } from './support/app';
import { createUser, database, inbox } from './support/users';

test.skip(
  ({ isMobile }) => isMobile,
  'signed-in flows run on desktop; test exercises narrow viewport explicitly',
);
async function setup(browser: Parameters<typeof asUser>[0]) {
  const gm = await createUser('Convite Mestre');
  const player = await createUser('Convite Jogador');
  const host = await asUser(browser, gm);
  const guest = await asUser(browser, player);
  // Table creation has its own E2E coverage; this fixture keeps this test focused on consent.
  const slug = `invite-${crypto.randomUUID()}`;
  const fixtureDb = database();
  try {
    const [system] = await fixtureDb`select id from systems where status='approved' limit 1`;
    await fixtureDb`insert into game_tables(slug,title,gm_id,system_id,kind,capacity,starts_at,duration_minutes,timezone,join_mode,join_details)
      values(${slug},${uniqueTitle('Convite')},${gm.id},${system.id},'one_shot',1,${new Date(Date.now() + 3 * 86400000).toISOString()},60,'UTC','approval','https://private.example.test/only-confirmed')`;
  } finally {
    await fixtureDb.end();
  }
  await host.page.goto(`/tables/${slug}/manage`);
  await host.page.getByLabel('@username do jogador').fill(`@${player.username}`);
  await host.page.getByRole('button', { name: 'Enviar convite', exact: true }).click();
  await expect(host.page.getByText('0 confirmados · 1 reservadas · 0 disponíveis')).toBeVisible();
  await guest.page.goto(`/tables/${slug}`);
  const review = guest.page.getByRole('link', { name: 'Revisar meu convite' });
  await expect(review).toBeVisible();
  const href = (await review.getAttribute('href'))!;
  return { gm, player, host, guest, slug, href };
}
test('email link requests consent and the reserved last seat becomes confirmed once', async ({
  browser,
}) => {
  const { player, host, guest, slug, href } = await setup(browser);
  const mail = await inbox(player.email, { waitFor: /Convite para jogar/ });
  expect(mail.length).toBeGreaterThan(0);
  const decisionPath = new URL(href, guest.page.url()).pathname;
  expect(mail[0].text).toContain(decisionPath);
  expect(mail[0].text).not.toContain('private.example.test');
  await guest.page.goto(decisionPath);
  await guest.page.setViewportSize({ width: 390, height: 844 });
  await expect(guest.page.getByRole('button', { name: 'Aceitar convite' })).toBeVisible();
  const sql = database();
  try {
    const rows = await sql`select status from registrations where player_id=${player.id}`;
    expect(rows).toHaveLength(0);
  } finally {
    await sql.end();
  }
  await guest.page.getByRole('button', { name: 'Aceitar convite' }).click();
  await expect(guest.page.getByText('Convite aceito', { exact: true })).toBeVisible();
  await guest.page.goto(`/tables/${slug}`);
  await expect(guest.page.getByText('https://private.example.test/only-confirmed')).toBeVisible();
  await host.page.reload();
  await expect(host.page.getByText('1 confirmados · 0 reservadas · 0 disponíveis')).toBeVisible();
  await guest.context.close();
  await host.context.close();
});
test('decline prevents another invitation while allowing a voluntary request', async ({
  browser,
}) => {
  const { host, guest, slug, href, player } = await setup(browser);
  await guest.page.goto(href);
  await guest.page.getByRole('button', { name: 'Recusar convite' }).click();
  await expect(guest.page.getByText('Convite recusado', { exact: true })).toBeVisible();
  await host.page.reload();
  await host.page.getByLabel('@username do jogador').fill(`@${player.username}`);
  await host.page.getByRole('button', { name: 'Enviar convite', exact: true }).click();
  await expect(host.page.getByText(/Não foi possível atualizar o convite/).first()).toBeVisible();
  await guest.page.goto(`/tables/${slug}`);
  await guest.page.getByRole('button', { name: /Pedir vaga/ }).click();
  await guest.page.getByRole('button', { name: 'Enviar pedido' }).click();
  await expect(
    guest.page.getByText('Seu pedido foi enviado. Você recebe um aviso quando ele for respondido.'),
  ).toBeVisible();
  await guest.context.close();
  await host.context.close();
});
test('profile opt-out and a GM block cancel pending reservations without reviving old links', async ({
  browser,
}) => {
  const { host, guest, href } = await setup(browser);
  await guest.page.goto('/account/profile');
  await guest.page.getByRole('button', { name: 'Desativar convites', exact: true }).click();
  await expect(guest.page.getByText('Convites desativados', { exact: true })).toBeVisible();
  await guest.page.goto(href);
  await expect(guest.page.getByText('Convite cancelado', { exact: true })).toBeVisible();
  await guest.page.getByRole('button', { name: 'Bloquear convites deste mestre' }).click();
  await guest.page.goto('/account/profile');
  await guest.page.getByRole('button', { name: 'Permitir convites', exact: true }).click();
  await expect(guest.page.getByRole('button', { name: 'Desbloquear convites' })).toBeVisible();
  await guest.page.getByRole('button', { name: 'Desbloquear convites' }).click();
  await expect(guest.page.getByText('Você não bloqueou convites de nenhum mestre.')).toBeVisible();
  await guest.page.goto(href);
  await expect(guest.page.getByRole('button', { name: 'Aceitar convite' })).toHaveCount(0);
  await host.context.close();
  await guest.context.close();
});
