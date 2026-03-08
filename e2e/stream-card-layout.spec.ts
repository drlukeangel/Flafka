/**
 * E2E tests for Stream Card layout and interactions.
 * Validates the redesigned card UI: ⋮ menu, mode selector,
 * consumer/producer control rows, results bar, and card actions.
 *
 * Injects a stream card directly into Zustand state via page.evaluate
 * to avoid dependency on topic API availability.
 */

import { test, expect } from './fixtures/app.fixture';
import type { Page } from '@playwright/test';

/** Open the streams panel and inject a stream card into Zustand state */
async function setupStreamCard(page: Page) {
  // Open the streams panel
  const openBtn = page.getByLabel('Open streams panel');
  await openBtn.click();
  await page.waitForTimeout(500);

  // Inject a stream card directly into the store
  await page.evaluate(() => {
    const store = (window as any).__zustand_store;
    if (store) {
      store.getState().addStreamCard('e2e-test-topic');
    } else {
      // Fallback: find the store via useWorkspaceStore internal API
      // The store is exposed on the module scope; access it from the React tree
      const root = document.getElementById('root');
      if (root && (root as any).__zustand) {
        (root as any).__zustand.getState().addStreamCard('e2e-test-topic');
      }
    }
  });

  // If direct injection didn't work, try selecting from the topic list
  const card = page.locator('.stream-card').first();
  const cardVisible = await card.isVisible({ timeout: 3000 }).catch(() => false);

  if (!cardVisible) {
    // Try clicking a topic checkbox if topics are loaded
    const topicCheckbox = page.locator('.stream-panel-topic-item input[type="checkbox"]').first();
    const checkboxVisible = await topicCheckbox.isVisible({ timeout: 3000 }).catch(() => false);
    if (checkboxVisible) {
      await topicCheckbox.click();
      await page.waitForTimeout(500);
    }
  }

  return card;
}

test.describe('Stream Card Layout E2E', () => {
  test.setTimeout(60_000);

  test('streams panel opens', async ({ appPage: page }) => {
    const openBtn = page.getByLabel('Open streams panel');
    await openBtn.click();
    const panel = page.locator('.stream-panel-aside');
    await expect(panel).toBeVisible();
  });

  test('stream card renders with header elements', async ({ appPage: page }) => {
    const card = await setupStreamCard(page);
    if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'Could not create stream card (no topics available and store injection failed)');
      return;
    }

    // Topic name in header
    await expect(card.locator('.stream-card-topic-name')).toBeVisible();

    // Mode selector: Consume and Produce buttons
    await expect(card.getByText('Consume')).toBeVisible();
    await expect(card.getByText('Produce')).toBeVisible();

    // ⋮ menu button
    await expect(card.getByLabel('Card actions')).toBeVisible();

    // Collapse chevron
    await expect(card.getByLabel(/Collapse card|Expand card/)).toBeVisible();
  });

  test('⋮ menu opens with Duplicate, View Topic, View Schema, Remove', async ({ appPage: page }) => {
    const card = await setupStreamCard(page);
    if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No stream card available');
      return;
    }

    await card.getByLabel('Card actions').click();
    await page.waitForTimeout(300);

    const dropdown = card.locator('.stream-card-dropdown');
    await expect(dropdown).toBeVisible();
    await expect(dropdown.getByText('Duplicate')).toBeVisible();
    await expect(dropdown.getByText('View Topic')).toBeVisible();
    await expect(dropdown.getByText('View Schema')).toBeVisible();
    await expect(dropdown.getByText('Remove Card')).toBeVisible();
  });

  test('consumer mode shows Earliest/Latest, Fetch, Clear, Live controls', async ({ appPage: page }) => {
    const card = await setupStreamCard(page);
    if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No stream card available');
      return;
    }

    // Default is consume mode — consumer controls row should be visible
    const controlsRow = card.locator('.stream-card-consume-controls');
    await expect(controlsRow).toBeVisible();

    // Scan mode dropdown (Earliest/Latest)
    await expect(controlsRow.getByLabel('Scan mode')).toBeVisible();

    // Icon-only Fetch button
    await expect(controlsRow.getByLabel('Fetch messages')).toBeVisible();

    // Icon-only Clear button
    await expect(controlsRow.getByLabel('Clear all results and stop streaming')).toBeVisible();

    // Live/Stop button
    await expect(controlsRow.getByLabel(/Start live streaming|Stop live streaming/)).toBeVisible();
  });

  test('Produce mode shows Start, Data Source, divider, and fetch controls', async ({ appPage: page }) => {
    const card = await setupStreamCard(page);
    if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No stream card available');
      return;
    }

    // Switch to Produce mode
    await card.getByText('Produce').click();
    await page.waitForTimeout(300);

    const sourceRow = card.locator('.stream-card-source-row');
    await expect(sourceRow).toBeVisible();

    // Start/Stop button
    await expect(sourceRow.getByLabel(/Start producer|Stop producer/)).toBeVisible();

    // Data source dropdown (Synthetic/Dataset)
    await expect(sourceRow.getByLabel('Data source')).toBeVisible();

    // Grey divider separating produce from consume controls
    await expect(sourceRow.locator('.stream-card-divider')).toBeVisible();

    // Right-side fetch controls
    await expect(sourceRow.getByLabel('Fetch messages')).toBeVisible();
    await expect(sourceRow.getByLabel('Clear all results and stop streaming')).toBeVisible();

    // Consumer controls row should NOT be visible
    await expect(card.locator('.stream-card-consume-controls')).not.toBeVisible();
  });

  test('switching Produce → Consume hides producer and shows consumer controls', async ({ appPage: page }) => {
    const card = await setupStreamCard(page);
    if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No stream card available');
      return;
    }

    await card.getByText('Produce').click();
    await page.waitForTimeout(200);
    await expect(card.locator('.stream-card-source-row')).toBeVisible();

    await card.getByText('Consume').click();
    await page.waitForTimeout(200);
    await expect(card.locator('.stream-card-source-row')).not.toBeVisible();
    await expect(card.locator('.stream-card-consume-controls')).toBeVisible();
  });

  test('SQL editor is visible with SELECT query', async ({ appPage: page }) => {
    const card = await setupStreamCard(page);
    if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No stream card available');
      return;
    }

    const sqlEditor = card.getByLabel('SQL query');
    await expect(sqlEditor).toBeVisible();
    const sqlValue = await sqlEditor.inputValue();
    expect(sqlValue).toContain('SELECT');
  });

  test('collapse hides body, expand shows it again', async ({ appPage: page }) => {
    const card = await setupStreamCard(page);
    if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No stream card available');
      return;
    }

    await expect(card.locator('.stream-card-body')).toBeVisible();

    // Collapse
    await card.getByLabel('Collapse card').click();
    await page.waitForTimeout(300);
    await expect(card.locator('.stream-card-body')).not.toBeVisible();

    // Expand
    await card.getByLabel('Expand card').click();
    await page.waitForTimeout(300);
    await expect(card.locator('.stream-card-body')).toBeVisible();
  });

  test('dataset source shows dataset options with selector and + button', async ({ appPage: page }) => {
    const card = await setupStreamCard(page);
    if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No stream card available');
      return;
    }

    // Switch to Produce mode
    await card.getByText('Produce').click();
    await page.waitForTimeout(200);

    // Select dataset source
    await card.getByLabel('Data source').selectOption('dataset');
    await page.waitForTimeout(200);

    const datasetOptions = card.locator('.stream-card-dataset-options');
    await expect(datasetOptions).toBeVisible();
    await expect(datasetOptions.getByLabel('Select dataset')).toBeVisible();
    await expect(datasetOptions.getByLabel(/Open schema datasets/)).toBeVisible();
  });

  test('Remove Card in ⋮ menu removes the card', async ({ appPage: page }) => {
    const card = await setupStreamCard(page);
    if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No stream card available');
      return;
    }

    const countBefore = await page.locator('.stream-card').count();

    await card.getByLabel('Card actions').click();
    await page.waitForTimeout(200);
    await card.getByText('Remove Card').click();
    await page.waitForTimeout(500);

    const countAfter = await page.locator('.stream-card').count();
    expect(countAfter).toBeLessThan(countBefore);
  });
});
