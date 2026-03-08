import { test, expect, goToLearn } from './fixtures/app.fixture';
import { SEL } from './helpers/selectors';

test.describe('Data Masking example', () => {
  test.beforeEach(async ({ appPage: page }) => {
    await goToLearn(page);
    await page.getByRole('tab', { name: 'Examples' }).click();
  });

  test('Data Masking card exists with correct tags', async ({ appPage: page }) => {
    const card = page.locator(SEL.card('loan-data-masking'));
    await expect(card).toBeVisible();
    await expect(card.locator('text=Data Masking')).toBeVisible();
    await expect(card.locator('text=Security')).toBeVisible();
    await expect(card.locator('text=Pattern')).toBeVisible();
  });

  test('Data Masking card has Set Up button', async ({ appPage: page }) => {
    const card = page.locator(SEL.card('loan-data-masking'));
    await expect(card.getByRole('button', { name: 'Set Up' })).toBeVisible();
  });

  test('Data Masking card appears after schema cards and before UDF cards', async ({ appPage: page }) => {
    const cards = page.locator('[data-testid^="example-card-"]');
    const allIds: string[] = [];
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const testId = await cards.nth(i).getAttribute('data-testid');
      if (testId) allIds.push(testId.replace('example-card-', ''));
    }
    const schemaOverrideIdx = allIds.indexOf('loan-schema-override');
    const dataMaskingIdx = allIds.indexOf('loan-data-masking');
    const scalarIdx = allIds.indexOf('loan-scalar-extract');

    expect(schemaOverrideIdx).toBeLessThan(dataMaskingIdx);
    expect(dataMaskingIdx).toBeLessThan(scalarIdx);
  });

  test('Data Masking card does NOT have UDF badge', async ({ appPage: page }) => {
    const card = page.locator(SEL.card('loan-data-masking'));
    await expect(card).toBeVisible();
    // Should NOT have UDF banner since it's pure SQL
    await expect(card.locator('text=UDF — Uses Custom Functions')).not.toBeVisible();
  });
});
