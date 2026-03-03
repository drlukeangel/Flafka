import { test as base, expect, type Page } from '@playwright/test';

/** Custom fixture that clears localStorage and waits for the app to load. */
export const test = base.extend<{ appPage: Page }>({
  appPage: async ({ page }, use) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByLabel('Main navigation').waitFor({ state: 'visible' });
    await use(page);
  },
});

export { expect };

/** Navigate to the Examples panel and wait for it to be visible. */
export async function goToExamples(page: Page) {
  await page.getByRole('button', { name: 'Examples' }).click();
  await expect(page.getByLabel('Examples panel')).toBeVisible();
}

/** Wait for a toast notification of the given type. */
export async function waitForToast(
  page: Page,
  type: 'success' | 'error',
  timeout = 180_000,
) {
  return page.locator(`.toast-${type}`).waitFor({ state: 'visible', timeout });
}
