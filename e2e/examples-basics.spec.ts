import { test, expect, goToLearn, waitForToast } from './fixtures/app.fixture';
import { SEL } from './helpers/selectors';

test.describe('Basics examples', () => {
  test.beforeEach(async ({ appPage: page }) => {
    await goToLearn(page);
    await page.getByRole('tab', { name: 'Examples' }).click();
  });

  test('Hello Flink card exists and can be set up', async ({ appPage: page }) => {
    const card = page.locator(SEL.card('hello-flink'));
    await expect(card).toBeVisible();
    await expect(card.locator('text=Hello Flink')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Set Up' })).toBeVisible();
  });

  test('Good Jokes Filter card exists and can be set up', async ({ appPage: page }) => {
    const card = page.locator(SEL.card('good-jokes'));
    await expect(card).toBeVisible();
    await expect(card.locator('text=Good Jokes Filter')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Set Up' })).toBeVisible();
  });

  test('Loan Filter card exists and can be set up', async ({ appPage: page }) => {
    const card = page.locator(SEL.card('loan-filter'));
    await expect(card).toBeVisible();
    await expect(card.locator('text=Loan Filter')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Set Up' })).toBeVisible();
  });

  test('Hello Flink runs end-to-end', async ({ appPage: page }) => {
    const card = page.locator(SEL.card('hello-flink'));
    await card.getByRole('button', { name: 'Set Up' }).click();
    await waitForToast(page, 'success');

    // Verify workspace loaded
    await expect(page.getByLabel('Main navigation')).toBeVisible();
  });
});
