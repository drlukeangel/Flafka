import { test, expect, goToExamples } from './fixtures/app.fixture';
import { SEL } from './helpers/selectors';

test.describe('Loan Tradeline Explode (Python UDF)', () => {
  test('Python card shows Coming Soon status', async ({ appPage: page }) => {
    await goToExamples(page);
    const card = page.locator(SEL.PYTHON_CARD);
    await expect(card).toBeVisible();
    await expect(card.getByRole('button', { name: 'Coming Soon' })).toBeVisible();
    // Should NOT have a Set Up button
    await expect(card.getByRole('button', { name: 'Set Up' })).not.toBeVisible();
  });
});
