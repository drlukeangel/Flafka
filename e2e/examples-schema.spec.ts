import { test, expect, goToLearn } from './fixtures/app.fixture';
import { SEL } from './helpers/selectors';

test.describe('Schema examples', () => {
  test.beforeEach(async ({ appPage: page }) => {
    await goToLearn(page);
    await page.getByRole('tab', { name: 'Examples' }).click();
  });

  test('Schemaless Topic card exists with schema banner', async ({ appPage: page }) => {
    const card = page.locator(SEL.card('loan-schemaless-topic'));
    await expect(card).toBeVisible();
    await expect(card.locator('text=Schemaless Topic').first()).toBeVisible();
    // Schema banner should be visible
    await expect(card.locator('text=Schema Injection').first()).toBeVisible();
  });

  test('Topic Schema Override card exists with schema banner', async ({ appPage: page }) => {
    const card = page.locator(SEL.card('loan-schema-override'));
    await expect(card).toBeVisible();
    await expect(card.locator('text=Topic Schema Override')).toBeVisible();
    await expect(card.locator('text=Schema Injection')).toBeVisible();
  });

  test('schema cards appear after stateful cards', async ({ appPage: page }) => {
    const cards = page.locator('[data-testid^="example-card-"]');
    const allIds: string[] = [];
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const testId = await cards.nth(i).getAttribute('data-testid');
      if (testId) allIds.push(testId.replace('example-card-', ''));
    }
    const streamEnrichIdx = allIds.indexOf('loan-stream-enrichment');
    const schemalessIdx = allIds.indexOf('loan-schemaless-topic');
    expect(streamEnrichIdx).toBeLessThan(schemalessIdx);
  });
});
