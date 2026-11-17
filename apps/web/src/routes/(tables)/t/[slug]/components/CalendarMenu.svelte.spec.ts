import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CalendarMenu from './CalendarMenu.svelte';

const props = {
  googleHref: 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Mesa',
  icsHref: '/t/mesa-do-dragao/calendar',
};
const trigger = () => page.getByRole('button', { name: 'Adicionar à agenda' });

describe('CalendarMenu', () => {
  it('offers Google Agenda and the .ics from a menu on a wide screen', async () => {
    await page.viewport(1280, 800);
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(CalendarMenu, props);

    await expect.element(trigger()).toHaveAttribute('aria-haspopup', 'menu');
    await trigger().click();
    await expect.element(page.getByRole('menuitem', { name: /Apple, Outlook/ })).toBeVisible();
    await page.getByRole('menuitem', { name: /Google Agenda/ }).click();

    expect(open).toHaveBeenCalledWith(props.googleHref, '_blank', 'noopener,noreferrer');
    open.mockRestore();
  });

  it('opens a sheet with both links on a phone', async () => {
    await page.viewport(390, 844);
    render(CalendarMenu, props);

    await expect.element(trigger()).toHaveAttribute('aria-haspopup', 'dialog');
    await trigger().click();

    const sheet = page.getByRole('dialog', { name: 'Adicionar à agenda' });
    await expect.element(sheet).toBeVisible();
    await expect
      .element(sheet.getByRole('link', { name: /Google Agenda/ }))
      .toHaveAttribute('href', props.googleHref);
    await expect
      .element(sheet.getByRole('link', { name: /Apple, Outlook/ }))
      .toHaveAttribute('href', props.icsHref);
  });
});
