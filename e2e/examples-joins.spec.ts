import { test, expect, goToLearn } from './fixtures/app.fixture';
import { SEL } from './helpers/selectors';

test.describe('Join examples', () => {
  test.beforeEach(async ({ appPage: page }) => {
    await goToLearn(page);
    await page.getByRole('tab', { name: 'Examples' }).click();
  });

  test('Loan Fraud Monitor card exists', async ({ appPage: page }) => {
    const card = page.locator(SEL.card('loan-join'));
    await expect(card).toBeVisible();
    await expect(card.locator('text=Loan Fraud Monitor').first()).toBeVisible();
    await expect(card.locator('text=Join').first()).toBeVisible();
  });

  test('Loan Enrichment card exists with stateful badge', async ({ appPage: page }) => {
    const card = page.locator(SEL.card('loan-temporal-join'));
    await expect(card).toBeVisible();
    await expect(card.locator('text=Loan Enrichment')).toBeVisible();
    // Stateful banner should be visible
    await expect(card.locator('text=Stateful')).toBeVisible();
  });

  test('ksqlDB Dynamic Routing (Avro) card exists with stateful badge', async ({ appPage: page }) => {
    const card = page.locator(SEL.card('ksql-dynamic-routing'));
    await expect(card).toBeVisible();
    await expect(card.locator('text=Dynamic Routing (ksqlDB)')).toBeVisible();
    await expect(card.locator('text=Stateful')).toBeVisible();
    await expect(card.locator('text=ksqlDB')).toBeVisible();
  });

  test('ksqlDB Dynamic Routing JSON card exists with correct tags', async ({ appPage: page }) => {
    const card = page.locator(SEL.card('ksql-dynamic-routing-json'));
    await expect(card).toBeVisible();
    await expect(card.locator('text=Dynamic Routing JSON (ksqlDB)')).toBeVisible();
    await expect(card.locator('text=Stateful')).toBeVisible();
    await expect(card.locator('text=JSON')).toBeVisible();
    await expect(card.locator('text=EXPLODE')).toBeVisible();
  });

  test('join cards appear after window cards', async ({ appPage: page }) => {
    const cards = page.locator('[data-testid^="example-card-"]');
    const allIds: string[] = [];
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const testId = await cards.nth(i).getAttribute('data-testid');
      if (testId) allIds.push(testId.replace('example-card-', ''));
    }
    const sessionIdx = allIds.indexOf('loan-session-window');
    const joinIdx = allIds.indexOf('loan-join');
    expect(sessionIdx).toBeLessThan(joinIdx);
  });
});
