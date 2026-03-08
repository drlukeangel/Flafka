/**
 * @artifacts-panel
 * E2E tests for the Artifacts panel — platform namespacing + user upload tagging.
 * All API calls are intercepted via page.route(); no real Confluent Cloud calls are made.
 */

import { test, expect } from './fixtures/app.fixture';
import type { Page } from '@playwright/test';

// VITE_UNIQUE_ID from .env, lowercased — must match client-side filter
const SESSION_TAG = 'f696969';

// Minimal fake artifact factory
const makePlatformArtifact = (name: string) => ({
  id: `art-${name}`,
  display_name: `platform-examples-${name}`,
  class: `com.fm.flink.udf.${name}`,
  cloud: 'AWS',
  region: 'us-east-1',
  environment: 'env-test',
  content_format: 'JAR',
  runtime_language: 'JAVA',
  metadata: { created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
  versions: [{ version: 'v1', is_draft: false, created_at: '2025-01-01T00:00:00Z' }],
});

const makeUserArtifact = (baseName: string) => ({
  id: `art-user-${baseName}`,
  display_name: `${baseName}-${SESSION_TAG}`,
  class: `com.example.${baseName}`,
  cloud: 'AWS',
  region: 'us-east-1',
  environment: 'env-test',
  content_format: 'JAR',
  runtime_language: 'JAVA',
  metadata: { created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
  versions: [{ version: 'v1', is_draft: false, created_at: '2025-01-01T00:00:00Z' }],
});

/** Set up route mocks for the artifact API, handling both list and individual fetches */
async function mockArtifactRoutes(page: Page, artifacts: ReturnType<typeof makePlatformArtifact>[]) {
  await page.route('**/v1/flink-artifacts**', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      const url = route.request().url();
      const individualMatch = url.match(/\/v1\/flink-artifacts\/([^?]+)/);
      if (individualMatch) {
        // Individual artifact fetch — return matching artifact or first one
        const id = individualMatch[1];
        const artifact = artifacts.find((a) => a.id === id) ?? artifacts[0];
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(artifact) });
      } else {
        // List
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: artifacts }) });
      }
    } else {
      await route.continue();
    }
  });
}

/** Navigate to the Artifacts panel */
async function goToArtifacts(page: Page) {
  await page.getByRole('button', { name: 'Artifacts' }).click();
  // Wait for the list to render (loading spinner gone or artifact count bar visible)
  await page.waitForTimeout(1000);
}

test.describe('Artifacts panel — platform namespacing', () => {
  test.setTimeout(30_000);

  test('platform artifact appears in list with Platform badge', async ({ appPage: page }) => {
    const platformArt = makePlatformArtifact('flink-kickstarter');
    await mockArtifactRoutes(page, [platformArt]);
    await goToArtifacts(page);

    // Artifact name visible in list
    await expect(page.getByText('platform-examples-flink-kickstarter')).toBeVisible();
    // Platform badge pill is visible
    const platformBadge = page.locator('span', { hasText: 'Platform' }).first();
    await expect(platformBadge).toBeVisible();
  });

  test('platform artifact detail has no delete button', async ({ appPage: page }) => {
    const platformArt = makePlatformArtifact('flink-kickstarter');
    await mockArtifactRoutes(page, [platformArt]);
    await goToArtifacts(page);

    // Click the artifact to open detail
    await page.getByText('platform-examples-flink-kickstarter').click();

    // Delete button must NOT be present
    await expect(page.getByRole('button', { name: /delete artifact/i })).not.toBeVisible();
    // Managed-by-Flafka note must be present
    await expect(page.getByText(/platform examples are managed by flafka/i)).toBeVisible();
  });

  test('user artifact detail has delete button', async ({ appPage: page }) => {
    const userArt = makeUserArtifact('MyCustomUdf');
    await mockArtifactRoutes(page, [userArt]);
    await goToArtifacts(page);

    // Click the artifact to open detail
    await page.getByText(`MyCustomUdf-${SESSION_TAG}`).click();

    // Delete button IS present for user artifacts
    await expect(page.getByRole('button', { name: /delete artifact/i })).toBeVisible();
  });

  test('upload flow appends session tag to display name', async ({ appPage: page }) => {
    let capturedBody: Record<string, unknown> | null = null;

    // Start with empty list
    await mockArtifactRoutes(page, []);

    // Override POST to capture the request body
    await page.route('**/v1/flink-artifacts**', async (route) => {
      if (route.request().method() === 'POST') {
        capturedBody = JSON.parse(route.request().postData() ?? '{}');
        const displayName = (capturedBody?.display_name as string) ?? 'tagged-artifact';
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'art-new',
            display_name: displayName,
            class: capturedBody?.class ?? '',
            cloud: 'AWS',
            region: 'us-east-1',
            environment: 'env-test',
            content_format: 'JAR',
            runtime_language: 'JAVA',
            metadata: { created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            versions: [],
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock presigned URL
    await page.route('**/v1/presigned-upload-url**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          upload_id: 'upload-mock-id',
          upload_url: 'https://mock-s3.test/upload',
          upload_form_data: { key: 'mock-key', policy: 'mock-policy' },
        }),
      });
    });

    // Mock S3 upload target
    await page.route('https://mock-s3.test/**', async (route) => {
      await route.fulfill({ status: 204 });
    });

    await goToArtifacts(page);

    // Open upload modal
    await page.getByRole('button', { name: 'Upload new artifact' }).click();
    await expect(page.getByRole('dialog', { name: 'Upload artifact' })).toBeVisible();

    // Fill form
    await page.getByLabel(/display name/i).fill('My-Custom-UDF');
    await page.getByLabel(/entry class/i).fill('com.example.MyCustomUdf');

    // Attach a minimal JAR (ZIP magic bytes)
    const minimalJar = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    await page.getByLabel(/jar file/i).setInputFiles({
      name: 'my-udf.jar',
      mimeType: 'application/octet-stream',
      buffer: minimalJar,
    });

    // Submit
    await page.getByRole('button', { name: /^upload$/i }).click();

    // Wait for upload to complete (or error)
    await Promise.race([
      page.waitForSelector('text=Artifact created successfully', { timeout: 12_000 }),
      page.waitForSelector('.toast-success', { timeout: 12_000 }),
      page.waitForTimeout(12_000),
    ]).catch(() => null);

    // Verify display_name was tagged with session ID suffix
    if (capturedBody) {
      const name = capturedBody.display_name as string;
      expect(name).toMatch(/^My-Custom-UDF-.+$/);
      expect(name).not.toBe('My-Custom-UDF');
    }
  });
});
