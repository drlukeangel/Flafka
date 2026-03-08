import { test, expect, goToLearn } from './fixtures/app.fixture';
import { SEL } from './helpers/selectors';

test.describe('Stateful examples', () => {
  test.beforeEach(async ({ appPage: page }) => {
    await goToLearn(page);
    await page.getByRole('tab', { name: 'Examples' }).click();
  });

  const statefulCards = [
    { id: 'loan-dedup', title: 'Deduplication' },
    { id: 'loan-cdc-pipeline', title: 'CDC Pipeline' },
    { id: 'loan-running-aggregate', title: 'Running Aggregate' },
    { id: 'loan-change-detection', title: 'Change Detection' },
    { id: 'loan-pattern-match', title: 'Pattern Match' },
    { id: 'loan-interval-join', title: 'Interval Join' },
    { id: 'loan-stream-enrichment', title: 'Stream Enrichment' },
  ];

  for (const { id, title } of statefulCards) {
    test(`${title} card exists with stateful badge`, async ({ appPage: page }) => {
      const card = page.locator(SEL.card(id));
      await expect(card).toBeVisible();
      await expect(card.locator(`text=${title}`).first()).toBeVisible();
      // All stateful cards should show the stateful banner
      await expect(card.locator('text=Stateful').first()).toBeVisible();
    });
  }

  test('stateful cards appear after join cards', async ({ appPage: page }) => {
    const cards = page.locator('[data-testid^="example-card-"]');
    const allIds: string[] = [];
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const testId = await cards.nth(i).getAttribute('data-testid');
      if (testId) allIds.push(testId.replace('example-card-', ''));
    }
    const temporalIdx = allIds.indexOf('loan-temporal-join');
    const dedupIdx = allIds.indexOf('loan-dedup');
    expect(temporalIdx).toBeLessThan(dedupIdx);
  });
});
