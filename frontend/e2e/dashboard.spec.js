import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const api = process.env.E2E_API_BASE_URL || 'http://localhost:8080/api';
test.beforeAll(() => {
  if (process.env.E2E_ALLOW_SYNTHETIC_WRITES !== 'true')
    throw new Error(
      'Set E2E_ALLOW_SYNTHETIC_WRITES=true only for an isolated synthetic database. These tests create records.',
    );
});
// Test captures stay ignored unless explicitly directed to a reviewed synthetic docs directory.
const screenDir =
  process.env.E2E_SCREENSHOT_DIR ||
  fileURLToPath(new URL('../test-results/screenshots/', import.meta.url));
test('creates customer/account, posts credit/debit, rejects overdraft, and persists an investigation', async ({
  page,
  request,
}) => {
  const name = `Portfolio Demo ${Date.now()}`;
  await page.goto('/#/customers');
  await page.getByRole('button', { name: 'Add customer' }).click();
  const customerDialog = page.getByRole('dialog');
  await customerDialog.getByLabel('Full name').fill(name);
  await customerDialog.getByLabel('Email address').fill(`portfolio-${Date.now()}@example.test`);
  await customerDialog.getByRole('button', { name: 'Create customer' }).click();
  await expect(customerDialog).toBeHidden();
  await page.getByRole('link', { name: 'Accounts', exact: true }).click();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  const accountDialog = page.getByRole('dialog');
  await accountDialog.getByLabel('Customer', { exact: true }).selectOption({
    label: `${name} · #${(await request.get(`${api}/customers`).then((response) => response.json())).find((customer) => customer.name === name).id}`,
  });
  const accountResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/accounts') && response.request().method() === 'POST',
  );
  await accountDialog.getByRole('button', { name: 'Create account', exact: true }).click();
  const account = await (await accountResponse).json();
  await expect(accountDialog).toBeHidden();
  await page.getByRole('link', { name: 'Transactions', exact: true }).click();
  let credit;
  for (const [type, amount] of [
    ['CREDIT', '12000.00'],
    ['DEBIT', '125.50'],
  ]) {
    await page.getByRole('button', { name: 'New transaction', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Account', { exact: true }).selectOption(String(account.id));
    await dialog.getByLabel('Transaction type').selectOption(type);
    await dialog.getByLabel('Amount (INR)').fill(amount);
    await dialog
      .getByLabel('Description (optional)')
      .fill(`Synthetic portfolio ${type.toLowerCase()}`);
    const response = page.waitForResponse(
      (result) =>
        result.url().endsWith('/api/transactions') && result.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: 'Post transaction' }).click();
    const record = await (await response).json();
    if (type === 'CREDIT') credit = record;
    await expect(
      page
        .getByRole('dialog')
        .getByRole('heading', { name: `Transaction #${record.id}`, exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Close dialog' }).click();
  }
  await page.getByLabel('Filter transactions by account').selectOption(String(account.id));
  await expect(page.getByRole('table')).toContainText('₹12,000.00');
  await expect(page.getByRole('table')).toContainText('₹125.50');
  await page.getByRole('button', { name: 'New transaction', exact: true }).click();
  const failed = page.getByRole('dialog');
  await failed.getByLabel('Account', { exact: true }).selectOption(String(account.id));
  await failed.getByLabel('Transaction type').selectOption('DEBIT');
  await failed.getByLabel('Amount (INR)').fill('99999');
  await failed.getByRole('button', { name: 'Post transaction' }).click();
  await expect(failed.getByRole('alert')).toContainText('Account has insufficient funds');
  await failed.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(
    (await request.get(`${api}/accounts/${account.id}/balance`).then((response) => response.json()))
      .balance,
  ).toBe(11874.5);
  let assessment;
  await expect
    .poll(
      async () => {
        const response = await request.get(`${api}/transactions/${credit.id}/risk`);
        if (response.status() === 200) {
          assessment = await response.json();
          return true;
        }
        return false;
      },
      { timeout: 30000 },
    )
    .toBe(true);
  await page.goto(`/#/alerts/${assessment.id}`);
  await expect(page.getByText(`Assessment ALT-${assessment.id}`, { exact: true })).toBeVisible();
  await page.getByLabel('Investigation status').selectOption('FALSE_POSITIVE');
  await page.getByLabel('Analyst name').fill('Portfolio Analyst');
  await page
    .getByLabel('Investigation notes')
    .fill('Synthetic example reviewed for dashboard verification.');
  await page.getByRole('button', { name: 'Save investigation review' }).click();
  await expect(
    page.getByText('Synthetic example reviewed for dashboard verification.'),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText('Synthetic example reviewed for dashboard verification.'),
  ).toBeVisible();
  await mkdir(screenDir, { recursive: true });
  await page.screenshot({ path: `${screenDir}/investigation.png`, fullPage: true });
});

test('desktop overview uses real data and filters, and captures a synthetic-only screenshot', async ({
  page,
}) => {
  await page.goto('/#/overview');
  await expect(page.getByText('API connected')).toBeVisible();
  await expect(page.getByText('Total transactions', { exact: true })).toBeVisible();
  await page.getByLabel('Dashboard period').selectOption('30');
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.locator('.recharts-surface').first()).toBeVisible();
  await page.screenshot({ path: `${screenDir}/overview-desktop.png`, fullPage: true });
  await page.getByRole('link', { name: 'Transactions', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Next page' })).toBeEnabled();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByText(/11–20 of/)).toBeVisible();
  await page.getByLabel('Search transactions').fill('no-such-synthetic-description');
  await expect(page.getByText('No matching records')).toBeVisible();
});

test('mobile navigation, keyboard dialog focus, and layout remain usable at 390px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/overview');
  await expect(page.getByText('Total transactions', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const donut = await page.locator('.donut').boundingBox();
  const pie = await page.locator('.donut .recharts-pie').boundingBox();
  expect(pie.x).toBeGreaterThanOrEqual(donut.x - 1);
  expect(pie.x + pie.width).toBeLessThanOrEqual(donut.x + donut.width + 1);
  await page.screenshot({ path: `${screenDir}/overview-mobile.png`, fullPage: true });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page
    .getByRole('dialog', { name: 'Navigation' })
    .getByRole('link', { name: 'Customers', exact: true })
    .click();
  await page.getByRole('button', { name: 'Add customer' }).click();
  const dialog = page.getByRole('dialog', { name: 'Create customer' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Add customer' })).toBeFocused();
});

test('API failures are visible and a retry recovers without showing fake records', async ({
  page,
}) => {
  await page.route(`${api}/**`, (route) => route.abort());
  await page.goto('/#/overview');
  await expect(page.getByRole('alert')).toContainText('Cannot reach the API');
  await expect(page.getByText('Total transactions', { exact: true })).toBeHidden();
  await page.unroute(`${api}/**`);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('Total transactions', { exact: true })).toBeVisible();
});
