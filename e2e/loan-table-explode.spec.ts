import { test, expect, goToExamples, waitForToast } from './fixtures/app.fixture';
import { SEL } from './helpers/selectors';
import { cleanupPython } from './helpers/cleanup';

test.describe('Loan Tradeline Explode (Python UDF)', () => {
  // Only clean Python resources — Java infra stays from prior spec (serial execution, workers: 1)
  test.beforeAll(async () => {
    await cleanupPython();
  });

  test('fresh setup creates UDF and navigates to workspace', async ({ appPage: page }) => {
    await goToExamples(page);
    const card = page.locator(SEL.PYTHON_CARD);
    await card.getByRole('button', { name: 'Set Up' }).click();

    await page.locator(SEL.progress('loan-table-explode')).waitFor({
      state: 'visible',
      timeout: 10_000,
    });

    await waitForToast(page, 'success', 180_000);

    // Verify workspace has the LATERAL TABLE query
    await expect(page.locator('text=LATERAL TABLE')).toBeVisible();
  });

  test('shared infra: does not re-create input topic', async ({ appPage: page }) => {
    await cleanupPython();

    // Intercept all network requests to track topic creation
    const topicCreates: string[] = [];
    await page.route('**/kafka/v3/clusters/*/topics', (route, request) => {
      if (request.method() === 'POST') {
        topicCreates.push(request.url());
      }
      route.continue();
    });

    await goToExamples(page);
    const card = page.locator(SEL.PYTHON_CARD);
    await card.getByRole('button', { name: 'Set Up' }).click();

    await waitForToast(page, 'success', 180_000);

    // No topic creation request should have been made for the shared input topic
    // (it already exists from the Java UDF setup)
    const inputTopicCreates = topicCreates.filter((url) =>
      url.includes('LOAN-APPLICATIONS'),
    );
    expect(inputTopicCreates).toHaveLength(0);

    await page.unroute('**/kafka/v3/clusters/*/topics');
  });

  test('idempotent re-run succeeds without errors', async ({ appPage: page }) => {
    await goToExamples(page);
    const card = page.locator(SEL.PYTHON_CARD);
    await card.getByRole('button', { name: 'Set Up' }).click();

    await waitForToast(page, 'success', 180_000);
    await expect(page.locator(SEL.TOAST_ERROR)).not.toBeVisible();
  });

  test('aria-busy is set during setup', async ({ appPage: page }) => {
    await cleanupPython();

    await goToExamples(page);
    const card = page.locator(SEL.PYTHON_CARD);

    // Click and immediately check aria-busy on the Set Up button specifically
    await card.getByRole('button', { name: 'Set Up' }).click();
    const setupBtn = card.getByRole('button', { name: /Set Up|Setting up/i });
    await expect(setupBtn).toHaveAttribute('aria-busy', 'true');

    // Wait for completion
    await waitForToast(page, 'success', 180_000);
  });
});
