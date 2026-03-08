import { test, expect, goToLearn } from './fixtures/app.fixture';
import { SEL } from './helpers/selectors';

test.describe('UDF examples', () => {
  test.beforeEach(async ({ appPage: page }) => {
    await goToLearn(page);
    await page.getByRole('tab', { name: 'Examples' }).click();
  });

  const udfCards = [
    { id: 'loan-scalar-extract', title: 'Loan Detail Extract' },
    { id: 'loan-tradeline-java', title: 'Loan Tradeline Explode' },
    { id: 'loan-aggregate-udf', title: 'Portfolio Stats' },
    { id: 'loan-validation', title: 'Dead-Letter Validation' },
    { id: 'loan-pii-masking', title: 'PII Masking' },
    { id: 'loan-async-enrichment', title: 'Credit Bureau Enrichment' },
  ];

  for (const { id, title } of udfCards) {
    test(`${title} card exists with UDF badge`, async ({ appPage: page }) => {
      const card = page.locator(SEL.card(id));
      await expect(card).toBeVisible();
      // UDF banner should be visible
      await expect(card.locator('text=UDF').first()).toBeVisible();
    });
  }

  test('Python UDF card shows Coming Soon', async ({ appPage: page }) => {
    const card = page.locator(SEL.card('loan-table-explode'));
    await expect(card).toBeVisible();
    await expect(card.locator('text=Loan Tradeline Explode (Python)')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Coming Soon' })).toBeVisible();
  });

  test('UDF cards have Set Up buttons (except Coming Soon)', async ({ appPage: page }) => {
    for (const { id } of udfCards) {
      const card = page.locator(SEL.card(id));
      await expect(card.getByRole('button', { name: 'Set Up' })).toBeVisible();
    }
  });

  test('UDF cards appear after schema cards', async ({ appPage: page }) => {
    const cards = page.locator('[data-testid^="example-card-"]');
    const allIds: string[] = [];
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const testId = await cards.nth(i).getAttribute('data-testid');
      if (testId) allIds.push(testId.replace('example-card-', ''));
    }
    const schemaOverrideIdx = allIds.indexOf('loan-schema-override');
    const scalarIdx = allIds.indexOf('loan-scalar-extract');
    expect(schemaOverrideIdx).toBeLessThan(scalarIdx);
  });

  test('UDF titles do not have (Java UDF) suffix', async ({ appPage: page }) => {
    // The titles should NOT contain "(Java UDF)" anymore
    const scalarCard = page.locator(SEL.card('loan-scalar-extract'));
    await expect(scalarCard.locator('text=Loan Detail Extract').first()).toBeVisible();
    // Make sure old title is gone
    await expect(scalarCard.locator('text=(Java UDF)')).not.toBeVisible();

    const tradelineCard = page.locator(SEL.card('loan-tradeline-java'));
    await expect(tradelineCard.locator('text=Loan Tradeline Explode').first()).toBeVisible();
    await expect(tradelineCard.locator('text=(Java UDF)')).not.toBeVisible();

    const portfolioCard = page.locator(SEL.card('loan-aggregate-udf'));
    await expect(portfolioCard.locator('text=Portfolio Stats').first()).toBeVisible();
    await expect(portfolioCard.locator('text=(UDF)')).not.toBeVisible();
  });
});
