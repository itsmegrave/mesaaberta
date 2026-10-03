import type { Page } from '@playwright/test';

/**
 * How far the page scrolls sideways, in pixels (0 when it does not). The text is set in Verdana
 * first: the app uses the system font, which is wider on the Linux CI runner than on a Mac, so a
 * layout that only fits with a narrow font must fail here too, not only in CI.
 */
export async function sidewaysOverflow(page: Page) {
  const { overflow, wide } = await page.evaluate(() => {
    for (const element of document.querySelectorAll<HTMLElement>('body *')) {
      element.style.setProperty('font-family', 'Verdana, sans-serif', 'important');
    }
    const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    if (overflow > 0) {
      // Name the widest culprits, so a failure says what to fix and not only by how much.
      const wide = [...document.querySelectorAll<HTMLElement>('body *')]
        .filter(
          (element) => element.getBoundingClientRect().right > document.documentElement.clientWidth,
        )
        .slice(0, 8)
        .map(
          (element) => `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 60)}`,
        );
      return { overflow, wide };
    }
    return { overflow, wide: [] as string[] };
  });
  // The culprits go to the log of the run, next to the failure.
  if (overflow > 0) console.log(`sideways by ${overflow}px: ${wide.join(' | ')}`);
  return overflow;
}
