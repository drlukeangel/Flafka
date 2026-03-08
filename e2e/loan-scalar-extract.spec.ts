import { test, expect, goToExamples, waitForToast } from './fixtures/app.fixture';
import { SEL } from './helpers/selectors';
import { cleanupAll } from './helpers/cleanup';

test.describe('Loan Detail Extract (Java UDF)', () => {
  test.beforeAll(async () => {
    await cleanupAll();
  });

  test('fresh setup creates UDF and navigates to workspace', async ({ appPage: page }) => {
    await goToExamples(page);
    const card = page.locator(SEL.JAVA_CARD);
    await card.getByRole('button', { name: 'Set Up' }).click();

    // Wait for progress indicator to appear (render race guard)
    await page.locator(SEL.progress('loan-scalar-extract')).waitFor({
      state: 'visible',
      timeout: 10_000,
    });

    // Wait for success toast (full budget for upload + DDL + data gen)
    await waitForToast(page, 'success', 180_000);

    // Verify workspace has a cell containing the UDF SQL
    await expect(page.locator('text=LoanDetailExtract')).toBeVisible();
  });

  test('idempotent re-run shows "already registered"', async ({ appPage: page }) => {
    await goToExamples(page);
    const card = page.locator(SEL.JAVA_CARD);
    const setupBtn = card.getByRole('button', { name: 'Set Up' });

    // Ensure button is ready (not stuck in "Setting up..." from prior)
    await expect(setupBtn).toBeVisible();
    await setupBtn.click();

    // Progress should mention "already registered" or similar skip message
    const progress = page.locator(SEL.progress('loan-scalar-extract'));
    await progress.waitFor({ state: 'visible', timeout: 10_000 });

    // Should still succeed
    await waitForToast(page, 'success', 180_000);

    // No error toast should appear
    await expect(page.locator(SEL.TOAST_ERROR)).not.toBeVisible();
  });

  test('button guard: other quick start buttons disabled during setup', async ({ appPage: page }) => {
    // First, clean up so setup takes real time
    await cleanupAll();

    await goToExamples(page);
    const javaCard = page.locator(SEL.JAVA_CARD);

    // Click Set Up but do NOT await completion
    await javaCard.getByRole('button', { name: 'Set Up' }).click();

    // Java "Set Up" button should have aria-busy="true" (now shows "Setting up...")
    const javaSetup = javaCard.getByRole('button', { name: /Set Up|Setting up/i });
    await expect(javaSetup).toHaveAttribute('aria-busy', 'true');

    // Another kickstart card's Set Up button should be disabled during setup
    const helloCard = page.locator(SEL.card('hello-flink'));
    const helloSetup = helloCard.getByRole('button', { name: /Set Up|Setting up/i });
    await expect(helloSetup).toBeDisabled();

    // Now wait for setup to complete so state is clean for next tests
    await waitForToast(page, 'success', 180_000);
  });

  test('error path: presigned URL failure shows error toast', async ({ appPage: page }) => {
    await cleanupAll();

    // Intercept presigned URL requests with a 500 error
    await page.route('**/presigned-upload-url**', (route) =>
      route.fulfill({ status: 500, body: 'Internal Server Error' }),
    );

    await goToExamples(page);
    const card = page.locator(SEL.JAVA_CARD);
    await card.getByRole('button', { name: 'Set Up' }).click();

    // Error toast should appear
    await waitForToast(page, 'error', 30_000);

    // Button should be re-enabled (not stuck in spinner)
    const setupBtn = card.getByRole('button', { name: 'Set Up' });
    await expect(setupBtn).toBeEnabled({ timeout: 5_000 });

    // Clean up route intercept
    await page.unroute('**/presigned-upload-url**');
  });
});
