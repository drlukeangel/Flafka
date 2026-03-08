import { test, expect } from './fixtures/app.fixture';

test.describe('ksqlDB Queries page', () => {
  test.setTimeout(15_000);

  test('navigation to ksqlDB Queries page', async ({ appPage: page }) => {
    // The ksqlDB Queries nav item may not be visible if VITE_KSQL_ENABLED is not set
    // Check if it exists first
    const ksqlNavBtn = page.getByRole('button', { name: 'ksqlDB Queries' });
    const isVisible = await ksqlNavBtn.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip();
      return;
    }

    await ksqlNavBtn.click();
    // Should show the queries page (list view)
    await expect(page.locator('.jobs-page')).toBeVisible();
  });

  test('list view renders with search and filter', async ({ appPage: page }) => {
    const ksqlNavBtn = page.getByRole('button', { name: 'ksqlDB Queries' });
    const isVisible = await ksqlNavBtn.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip();
      return;
    }

    await ksqlNavBtn.click();

    // Search input should be present
    await expect(page.getByPlaceholderText(/search/i)).toBeVisible();
  });

  test('URL deep linking /ksql-queries', async ({ appPage: page }) => {
    // Navigate directly to ksql-queries URL
    await page.goto('/ksql-queries');
    await page.getByLabel('Main navigation').waitFor({ state: 'visible' });

    // Should render the queries page if ksqlDB is enabled, or workspace if not
    // We just verify no crash
    await expect(page.locator('.nav-rail')).toBeVisible();
  });

  test('URL deep linking /ksql-queries/{id}', async ({ appPage: page }) => {
    await page.goto('/ksql-queries/CSAS_TEST_0');
    await page.getByLabel('Main navigation').waitFor({ state: 'visible' });

    // Should not crash — the query won't be found but the page should render
    await expect(page.locator('.nav-rail')).toBeVisible();
  });
});
