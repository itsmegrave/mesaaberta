import { expect, type Browser, type Page } from '@playwright/test';
import type { TestUser } from './users';

/** Signs in through the real login form, then waits until the header shows who is signed in. */
export async function signIn(
  page: Page,
  user: Pick<TestUser, 'email' | 'password' | 'username'>,
  next = '/',
) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Senha').fill(user.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();

  await expect(accountMenu(page, user.username)).toBeVisible();
}

/** The visible account-menu trigger (desktop sidebar or mobile header). */
export const accountMenu = (page: Page, name: string) => {
  void name;
  return page.getByRole('button', { name: /menu da conta/i });
};

/** The brand link that leads home: in the desktop side rail, or in the phone's header (only one is shown). */
export const homeLink = (page: Page) =>
  page.getByRole('link', { name: 'Mesa Aberta', exact: true });

/** Signs out through the account menu. */
export async function signOut(page: Page, name: string) {
  await accountMenu(page, name).click();
  await page
    .getByRole('navigation', { name: 'Menu da conta' })
    .getByRole('button', { name: 'Sair' })
    .click();

  await expect(accountMenu(page, name)).toHaveCount(0);
}

/** Signed-in flows are long; they run on the desktop project only (the pages themselves run on both). */
export const desktopOnly = (isMobile: boolean) => ({
  skip: isMobile,
  reason: 'signed-in flows run on desktop only',
});

export type NewTable = {
  title: string;
  system?: string;
  kind?: 'one_shot' | 'campaign';
  capacity?: number;
  joinMode?: 'auto' | 'approval';
  description?: string;
  /** An in-person table: its public area and, optionally, the private address. */
  inPerson?: { area: string; address?: string };
  /** How to join an online table (private). */
  joinDetails?: string;
  image?: { name: string; mimeType: string; buffer: Buffer };
};

/**
 * Picks an option in a SearchSelect (the searchable dropdown): types part of its name, then clicks
 * it. Waits for the combobox first, since the page shows a plain <select> until it hydrates.
 */
export async function pickFromSearch(page: Page, label: string, option: string) {
  const input = page.getByRole('combobox', { name: label });
  await expect(input).toBeVisible();
  await input.fill(option.slice(0, 6));
  await page.getByRole('option', { name: option, exact: true }).click();
}

/** Moves the seats slider of a table form to `count`, with the keyboard, as a person would. */
export async function setSeats(page: Page, count: number) {
  const seats = page.getByRole('slider', { name: 'Vagas' });
  await seats.focus();
  await page.keyboard.press('Home');
  for (let seat = 1; seat < count; seat++) await page.keyboard.press('ArrowRight');
  await expect(seats).toHaveAttribute('aria-valuenow', String(count));
}

/**
 * Types the first session of a table form (`2099-06-01T19:00`) as a person would: the day as
 * dd/mm/aaaa in the date picker, then the hour.
 */
export async function setFirstSession(page: Page, iso: string) {
  const [day, time] = iso.split('T');
  const [year, month, date] = day.split('-');
  await page.getByLabel('Primeira sessão', { exact: true }).fill(`${date}/${month}/${year}`);
  await page.keyboard.press('Enter');
  await page.getByLabel('Hora de Primeira sessão').fill(time);
}

/** A title no other test uses, so tests that share a database do not collide. */
export const uniqueTitle = (prefix: string) =>
  `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Fills and submits the create form as the signed-in user. Returns the slug from the URL it lands on. */
export async function createTable(page: Page, table: NewTable) {
  await page.goto('/tables/new');
  await pickFromSearch(page, 'Sistema de RPG', table.system ?? 'Daggerheart');
  await page.getByLabel('Título').fill(table.title);
  if (table.description) await page.getByLabel('Descrição').fill(table.description);
  if (table.kind === 'campaign') await page.getByLabel('Campanha (várias sessões)').check();
  await setSeats(page, table.capacity ?? 5);
  await setFirstSession(page, '2099-06-01T19:00');
  if (table.joinMode === 'approval') await page.getByLabel(/Com a sua aprovação/).check();
  if (table.inPerson) {
    await page.getByLabel('Presencial', { exact: true }).check();
    await page.getByLabel('Bairro e cidade').fill(table.inPerson.area);
    if (table.inPerson.address) {
      await page.getByLabel('Endereço e como chegar').fill(table.inPerson.address);
    }
  }
  if (table.joinDetails) {
    await page.getByLabel(/Como entrar \(link/).fill(table.joinDetails);
  }
  if (table.image) await pickImage(page, table.image);
  await page.getByRole('button', { name: 'Abrir mesa' }).click();

  await expect(page).toHaveURL(/\/tables\/(?!new$)[^/]+$/);
  return new URL(page.url()).pathname.split('/').at(-1)!;
}

/**
 * Picks the table's image. A picture the browser can draw opens the crop step first, so this uses the
 * crop as it is; anything else is taken as it is. Either way it returns once the file is in the form.
 */
export async function pickImage(
  page: Page,
  file: { name: string; mimeType: string; buffer: Buffer },
) {
  await page.locator('input#image').setInputFiles(file);
  const crop = page.getByRole('button', { name: 'Usar este recorte' });
  const chip = page.getByRole('button', { name: /^Tirar / });
  await crop.or(chip).first().waitFor();
  if (await crop.isVisible()) await crop.click();
  await chip.waitFor();
}

/** A real 1x1 PNG, for the upload. */
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** A page in its own browser context (its own cookies), signed in as this user. Close the context when done. */
export async function asUser(
  browser: Browser,
  user: Pick<TestUser, 'email' | 'password' | 'username'>,
) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, user);
  return { page, context };
}

/** The "3 dots" beside a page's title (the first "Mais ações: …" on the page). */
export const pageMenu = (page: Page) => page.getByRole('button', { name: /^Mais ações:/ }).first();

/** Opens the page's title menu and picks an item. */
export async function chooseFromMenu(page: Page, item: string | RegExp) {
  await pageMenu(page).click();
  await page.getByRole('menuitem', { name: item }).click();
}
