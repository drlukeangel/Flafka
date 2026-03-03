import { test, expect, goToExamples, waitForToast } from './fixtures/app.fixture';
import { SEL } from './helpers/selectors';

test.describe('Debug Setup', () => {
  test('diagnose setup flow', async ({ appPage: page }) => {
    // Collect console messages
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Intercept createArtifact response to see error body
    const artifactResponses: Array<{ status: number; url: string; body: string }> = [];
    await page.route('**/v1/flink-artifacts', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const response = await route.fetch();
        const body = await response.text();
        artifactResponses.push({ status: response.status(), url: request.url(), body });
        console.log(`--- INTERCEPTED POST /v1/flink-artifacts: ${response.status()} ---`);
        console.log(`--- Body: ${body} ---`);
        console.log(`--- Request: ${request.postData()} ---`);
        await route.fulfill({ response });
      } else {
        await route.continue();
      }
    });

    await goToExamples(page);
    const card = page.locator(SEL.JAVA_CARD);
    const setupBtn = card.getByRole('button', { name: 'Set Up' });

    // Verify button exists
    await expect(setupBtn).toBeVisible({ timeout: 5_000 });
    console.log('--- Set Up button found, clicking ---');

    await setupBtn.click();

    // Wait for either toast (race)
    const successToast = page.locator(SEL.TOAST_SUCCESS);
    const errorToast = page.locator(SEL.TOAST_ERROR);

    // Check every 2 seconds for up to 120 seconds
    let found = '';
    for (let i = 0; i < 60; i++) {
      if (await successToast.isVisible().catch(() => false)) {
        const msg = await page.locator(SEL.TOAST_MESSAGE).textContent().catch(() => '');
        found = `SUCCESS: ${msg}`;
        break;
      }
      if (await errorToast.isVisible().catch(() => false)) {
        const msg = await page.locator(SEL.TOAST_MESSAGE).textContent().catch(() => '');
        found = `ERROR: ${msg}`;
        break;
      }
      // Check button state
      const btnText = await setupBtn.textContent().catch(() => 'gone');
      if (i % 5 === 0) {
        console.log(`--- [${i * 2}s] Button: "${btnText}" | Toasts: none ---`);
      }
      await page.waitForTimeout(2000);
    }

    console.log(`--- RESULT: ${found || 'NO TOAST AFTER 120s'} ---`);

    // Print relevant console messages
    const relevant = consoleLogs.filter(
      (l) => l.includes('Artifact') || l.includes('error') || l.includes('Error') || l.includes('400') || l.includes('Setup') || l.includes('toast'),
    );
    console.log('--- Relevant console messages ---');
    relevant.forEach((l) => console.log(l));

    expect(found).toBeTruthy();
  });
});
