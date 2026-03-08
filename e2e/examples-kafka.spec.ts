import { test, expect, goToLearn } from './fixtures/app.fixture';
import { SEL } from './helpers/selectors';

test.describe('Kafka / Confluent examples', () => {
  test.beforeEach(async ({ appPage: page }) => {
    await goToLearn(page);
    await page.getByRole('tab', { name: 'Examples' }).click();
  });

  test('Kafka Produce & Consume card exists and can be set up', async ({ appPage: page }) => {
    const card = page.locator(SEL.card('kafka-produce-consume'));
    await expect(card).toBeVisible();
    await expect(card.locator('text=Kafka Produce & Consume')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Set Up' })).toBeVisible();
  });

  test('Kafka Startup Modes card exists and can be set up', async ({ appPage: page }) => {
    const card = page.locator(SEL.card('kafka-startup-modes'));
    await expect(card).toBeVisible();
    await expect(card.locator('text=Kafka Startup Modes')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Set Up' })).toBeVisible();
  });

  test('Kafka Changelog Modes card exists and can be set up', async ({ appPage: page }) => {
    const card = page.locator(SEL.card('kafka-changelog-modes'));
    await expect(card).toBeVisible();
    await expect(card.locator('text=Kafka Changelog Modes')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Set Up' })).toBeVisible();
  });

  test('Kafka Value Formats card exists and can be set up', async ({ appPage: page }) => {
    const card = page.locator(SEL.card('kafka-value-formats'));
    await expect(card).toBeVisible();
    await expect(card.locator('text=Kafka Value Formats')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Set Up' })).toBeVisible();
  });

  test('Kafka Schema Evolution card exists and can be set up', async ({ appPage: page }) => {
    const card = page.locator(SEL.card('kafka-schema-evolution'));
    await expect(card).toBeVisible();
    await expect(card.locator('text=Kafka Schema Evolution')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Set Up' })).toBeVisible();
  });

  test('Confluent Connector Bridge card exists and can be set up', async ({ appPage: page }) => {
    const card = page.locator(SEL.card('confluent-connector-bridge'));
    await expect(card).toBeVisible();
    await expect(card.locator('text=Confluent Connector Bridge')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Set Up' })).toBeVisible();
  });
});
