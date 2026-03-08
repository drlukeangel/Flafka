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

/** Navigate to the Learn panel and wait for it to be visible. */
export async function goToLearn(page: Page) {
  await page.getByRole('button', { name: 'Learn' }).click();
  await expect(page.getByLabel('Learn panel')).toBeVisible();
}

/** @deprecated Use `goToLearn` instead. */
export async function goToExamples(page: Page) {
  return goToLearn(page);
}

/** Wait for a toast notification of the given type. */
export async function waitForToast(
  page: Page,
  type: 'success' | 'error',
  timeout = 180_000,
) {
  return page.locator(`.toast-${type}`).waitFor({ state: 'visible', timeout });
}
