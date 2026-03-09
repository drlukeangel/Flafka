import { test, expect, goToExamples, waitForToast } from './fixtures/app.fixture';
import { SEL } from './helpers/selectors';
import { cleanupAll } from './helpers/cleanup';

test.describe('UDF Setup — Parts D–G', () => {
  test.beforeAll(async () => {
    await cleanupAll();
  });

  test('Part D: Aggregate UDF setup creates WeightedAvg + LoanDetailExtract functions', async ({ appPage: page }) => {
    await goToExamples(page);
    const card = page.locator(SEL.card('loan-aggregate-udf'));
    await card.getByRole('button', { name: 'Set Up' }).click();

    await page.locator(SEL.progress('loan-aggregate-udf')).waitFor({ state: 'visible', timeout: 10_000 });
    await waitForToast(page, 'success', 240_000);

    await expect(page.locator('text=WeightedAvg').first()).toBeVisible();
    await expect(page.locator('text=LoanDetailExtract').first()).toBeVisible();
  });

  test('Part E: Validation setup creates LoanValidator + LoanDetailExtract functions', async ({ appPage: page }) => {
    await goToExamples(page);
    const card = page.locator(SEL.card('loan-validation'));
    await card.getByRole('button', { name: 'Set Up' }).click();

    await page.locator(SEL.progress('loan-validation')).waitFor({ state: 'visible', timeout: 10_000 });
    await waitForToast(page, 'success', 240_000);

    await expect(page.locator('text=LoanValidator').first()).toBeVisible();
    await expect(page.locator('text=LoanDetailExtract').first()).toBeVisible();
  });

  test('Part F: PII Masking setup creates PiiMask + LoanDetailExtract functions', async ({ appPage: page }) => {
    await goToExamples(page);
    const card = page.locator(SEL.card('loan-pii-masking'));
    await card.getByRole('button', { name: 'Set Up' }).click();

    await page.locator(SEL.progress('loan-pii-masking')).waitFor({ state: 'visible', timeout: 10_000 });
    await waitForToast(page, 'success', 240_000);

    await expect(page.locator('text=PiiMask').first()).toBeVisible();
    await expect(page.locator('text=LoanDetailExtract').first()).toBeVisible();
  });

  test('Part G: Async Enrichment setup creates CreditBureauEnrich + LoanDetailExtract functions', async ({ appPage: page }) => {
    test.setTimeout(540_000);

    await goToExamples(page);
    const card = page.locator(SEL.card('loan-async-enrichment'));
    await card.getByRole('button', { name: 'Set Up' }).click();

    await page.locator(SEL.progress('loan-async-enrichment')).waitFor({ state: 'visible', timeout: 10_000 });
    await waitForToast(page, 'success', 480_000);

    await expect(page.locator('text=CreditBureauEnrich').first()).toBeVisible();
    await expect(page.locator('text=LoanDetailExtract').first()).toBeVisible();
  });
});
