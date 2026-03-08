import { test, expect, goToLearn } from './fixtures/app.fixture';
import { SEL } from './helpers/selectors';

test.describe('Window examples', () => {
  test.beforeEach(async ({ appPage: page }) => {
    await goToLearn(page);
    await page.getByRole('tab', { name: 'Examples' }).click();
  });

  test('Loan Aggregate card exists with correct tags', async ({ appPage: page }) => {
    const card = page.locator(SEL.card('loan-aggregate'));
    await expect(card).toBeVisible();
    await expect(card.locator('text=Loan Aggregate').first()).toBeVisible();
    await expect(card.locator('text=Aggregation').first()).toBeVisible();
    await expect(card.locator('text=Window').first()).toBeVisible();
  });

  test('Hop Window card exists', async ({ appPage: page }) => {
    const card = page.locator(SEL.card('loan-hop-window'));
    await expect(card).toBeVisible();
    await expect(card.locator('text=Hop Window').first()).toBeVisible();
  });

  test('Session Window card exists', async ({ appPage: page }) => {
    const card = page.locator(SEL.card('loan-session-window'));
    await expect(card).toBeVisible();
    await expect(card.locator('text=Session Window').first()).toBeVisible();
  });

  test('Top-N Ranking card exists', async ({ appPage: page }) => {
    const card = page.locator(SEL.card('loan-top-n'));
    await expect(card).toBeVisible();
    await expect(card.locator('text=Top-N Ranking')).toBeVisible();
  });

  test('window cards appear before join cards', async ({ appPage: page }) => {
    const cards = page.locator('[data-testid^="example-card-"]');
    const allIds: string[] = [];
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const testId = await cards.nth(i).getAttribute('data-testid');
      if (testId) allIds.push(testId.replace('example-card-', ''));
    }
    const hopIdx = allIds.indexOf('loan-hop-window');
    const joinIdx = allIds.indexOf('loan-join');
    expect(hopIdx).toBeLessThan(joinIdx);
  });
});
