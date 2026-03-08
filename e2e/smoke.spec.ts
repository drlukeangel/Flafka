import { test, expect, goToExamples } from './fixtures/app.fixture';
import { SEL } from './helpers/selectors';

test.describe('Smoke tests', () => {
  test.setTimeout(15_000);

  test('app loads with nav rail visible', async ({ appPage: page }) => {
    await expect(page.getByLabel('Main navigation')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Examples' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Workspace', exact: true })).toBeVisible();
  });

  test('examples panel shows cards with setup buttons', async ({ appPage: page }) => {
    await goToExamples(page);
    const cards = page.locator('[data-testid^="example-card-"]');
    await expect(cards).toHaveCount(await cards.count()); // wait for render
    expect(await cards.count()).toBeGreaterThanOrEqual(10);

    // At least 2 cards have a "Set Up" button
    const setupButtons = page.getByRole('button', { name: 'Set Up' });
    expect(await setupButtons.count()).toBeGreaterThanOrEqual(2);
  });

  test('quick start cards have primary styling and tag', async ({ appPage: page }) => {
    await goToExamples(page);

    // Java card has Set Up button
    const javaCard = page.locator(SEL.JAVA_CARD);
    await expect(javaCard).toBeVisible();
    await expect(javaCard.locator('text=Quick Start')).toBeVisible();
    await expect(javaCard.getByRole('button', { name: 'Set Up' })).toBeVisible();

    // Python card has Coming Soon (no Set Up)
    const pythonCard = page.locator(SEL.PYTHON_CARD);
    await expect(pythonCard).toBeVisible();
    await expect(pythonCard.locator('text=Quick Start')).toBeVisible();
    await expect(pythonCard.getByRole('button', { name: 'Coming Soon' })).toBeVisible();
  });
});
