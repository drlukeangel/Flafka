import type { Page } from '@playwright/test';

/**
 * Wait for a cell's status badge to show "Completed".
 * Polls the cell identified by its label prefix until the status text appears.
 */
export async function waitForStatementCompleted(
  page: Page,
  cellLabel: string,
  timeout = 120_000,
): Promise<void> {
  // Cell labels are rendered in elements with data-testid or aria patterns
  // Find the cell container by label text, then look for status badge
  const cell = page.locator(`[data-testid*="${cellLabel}"], [aria-label*="${cellLabel}"]`).first();
  await cell.locator('text=Completed').waitFor({ state: 'visible', timeout });
}

/**
 * Wait for a results table to show at least N rows.
 * Polls the results area within the cell identified by label.
 */
export async function waitForResultRows(
  page: Page,
  cellLabel: string,
  minRows: number,
  timeout = 60_000,
): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const rows = await page.locator('.results-table tbody tr, .result-row, [data-testid="result-row"]').count();
    if (rows >= minRows) return;
    await page.waitForTimeout(2000);
  }
  throw new Error(`Timed out waiting for ${minRows} result rows (cell: ${cellLabel})`);
}

/**
 * Click the "Run" button on a specific cell identified by label.
 */
export async function runCell(page: Page, cellLabel: string): Promise<void> {
  const cell = page.locator(`[data-testid*="${cellLabel}"], [aria-label*="${cellLabel}"]`).first();
  await cell.getByRole('button', { name: /run|execute/i }).click();
}

/**
 * Click the "Set Up" button on a specific example card.
 */
export async function clickSetUp(page: Page, cardId: string): Promise<void> {
  const card = page.locator(`[data-testid="example-card-${cardId}"]`);
  await card.getByRole('button', { name: 'Set Up' }).click();
}

/**
 * Wait for setup to complete (success toast appears).
 */
export async function waitForSetupComplete(page: Page, timeout = 180_000): Promise<void> {
  await page.locator('.toast-success').waitFor({ state: 'visible', timeout });
}

/**
 * Click the produce/play button on a stream card.
 */
export async function clickProduce(page: Page): Promise<void> {
  // Stream cards have a play button to start producing
  const produceBtn = page.locator('[data-testid*="produce"], [aria-label*="Produce"], [title*="Produce"]').first();
  if (await produceBtn.isVisible()) {
    await produceBtn.click();
  }
}

/**
 * Verify that workspace cells were created with expected labels.
 */
export async function verifyCellLabels(page: Page, expectedLabels: string[]): Promise<boolean> {
  for (const label of expectedLabels) {
    const cell = page.locator(`text=${label}`).first();
    if (!(await cell.isVisible())) return false;
  }
  return true;
}
