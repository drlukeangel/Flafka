import { test, expect, goToLearn } from './fixtures/app.fixture';
import { SEL } from './helpers/selectors';

const NEW_CARD_IDS = [
  'loan-cumulate-window',
  'loan-coborrower-unnest',
  'loan-multi-region-merge',
  'loan-property-lookup',
  'loan-late-payments',
  'loan-time-range-stats',
  'loan-event-fanout',
  'loan-routing-json',
  'loan-routing-avro',
  'loan-borrower-payments',
  'ksql-dynamic-routing-json',
];

test.describe('New Pattern Examples', () => {
  test.beforeEach(async ({ appPage: page }) => {
    await goToLearn(page);
    await page.getByRole('tab', { name: 'Examples' }).click();
  });

  for (const id of NEW_CARD_IDS) {
    test(`${id} card is visible`, async ({ appPage: page }) => {
      const card = page.locator(SEL.card(id));
      await expect(card).toBeVisible();
    });
  }

  test('all new cards have skill level badges', async ({ appPage: page }) => {
    for (const id of NEW_CARD_IDS) {
      const badge = page.locator(`[data-testid="skill-badge-${id}"]`);
      await expect(badge).toBeVisible();
    }
  });

  test('new cards have Set Up buttons', async ({ appPage: page }) => {
    for (const id of NEW_CARD_IDS) {
      const card = page.locator(SEL.card(id));
      await expect(card.getByRole('button', { name: 'Set Up' })).toBeVisible();
    }
  });
});
