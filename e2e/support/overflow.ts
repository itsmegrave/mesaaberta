import type { Page } from '@playwright/test';

/**
 * How far the page scrolls sideways, in pixels (0 when it does not). The text is set in Verdana
 * first: the app uses the system font, which is wider on the Linux CI runner than on a Mac, so a
 * layout that only fits with a narrow font must fail here too, not only in CI.
 */
export async function sidewaysOverflow(page: Page) {
  return page.evaluate(() => {
    for (const element of document.querySelectorAll<HTMLElement>('body *')) {
      element.style.setProperty('font-family', 'Verdana, sans-serif', 'important');
    }
    return document.documentElement.scrollWidth - document.documentElement.clientWidth;
  });
}
