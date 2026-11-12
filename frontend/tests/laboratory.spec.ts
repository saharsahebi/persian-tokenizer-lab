import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('پردازشگر آماده است')).toBeVisible();
  await expect(page.getByRole('button', { name: /شروع توکن‌سازی/ })).toBeEnabled();
});

test('counts tokens and types and inspects source spans', async ({ page }) => {
  await page.getByRole('button', { name: 'یک جملهٔ ساده', exact: true }).click();
  await page.getByLabel('روش توکن‌سازی', { exact: true }).selectOption('whitespace');
  await page.getByRole('button', { name: /شروع توکن‌سازی/ }).click();
  await expect(page.locator('.stat-card').nth(0).locator('strong')).toHaveText('۷');
  await expect(page.locator('.stat-card').nth(1).locator('strong')).toHaveText('۶');
  await page.getByRole('tab', { name: 'توکن‌ها و واژگان', exact: true }).click();
  await page.getByRole('button', { name: 'توکن ۲: کتاب', exact: true }).click();
  await expect(page.locator('.inspected-text mark')).toHaveText('کتاب');
  await page.getByLabel('جست‌وجو در واژگان').fill('کتاب');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr td').nth(1)).toHaveText('۲');
});

test('trains BPE, freezes normalization and reports unseen codepoints', async ({ page }) => {
  await page.getByLabel('روش توکن‌سازی', { exact: true }).selectOption('bpe');
  await page.getByLabel('پیکرهٔ آموزش BPE').fill('کتاب کتاب کتاب‌ها کتابخانه');
  await page.getByLabel('متنِ شما', { exact: true }).fill('کتاب');
  await page.getByRole('button', { name: /آموزش و توکن‌سازی/ }).click();
  await expect(page.getByRole('button', { name: 'دریافت مدل' })).toBeVisible();
  await page.getByRole('button', { name: 'اجرای مدل ثابت', exact: true }).click();
  await page.getByLabel('متنِ شما', { exact: true }).fill('کتاب 🐈');
  await page.getByRole('button', { name: /شروع توکن‌سازی/ }).click();
  await expect(page.getByRole('heading', { name: 'الگوریتم را در عمل ببین' })).toBeVisible();
  await page.getByRole('tab', { name: 'توکن‌ها و واژگان', exact: true }).click();
  await expect(page.locator('.final-token.unknown')).toHaveText(/\[UNK\]/);
  await page.locator('.final-token.unknown').click();
  await expect(page.locator('.inspected-text mark')).toHaveText('🐈');
  await expect(page.locator('.inspector-meta')).toContainText('کدپوینت در متن: ۱');
  await page.getByLabel('روش توکن‌سازی', { exact: true }).selectOption('whitespace');
  await page.getByRole('switch', { name: 'نرمال‌سازی فارسی' }).click();
  await page.getByLabel('روش توکن‌سازی', { exact: true }).selectOption('bpe');
  await expect(page.getByRole('switch', { name: 'نرمال‌سازی فارسی' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByRole('switch', { name: 'نرمال‌سازی فارسی' })).toBeDisabled();
  await page.getByRole('button', { name: /شروع توکن‌سازی/ }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('makes half spaces visible and preserves emoji codepoints in the trace', async ({ page }) => {
  await page.getByLabel('روش توکن‌سازی', { exact: true }).selectOption('character');
  await page.getByRole('switch', { name: 'نرمال‌سازی فارسی' }).click();
  await page.getByLabel('متنِ شما', { exact: true }).fill('می‌روم 🐈');
  await page.getByRole('button', { name: /شروع توکن‌سازی/ }).click();
  const scrubber = page.getByLabel('انتخاب مرحله');
  await scrubber.fill((await scrubber.getAttribute('max')) || '0');
  await expect(page.locator('.trace-token[title="U+1F408"]')).toHaveText('🐈');
  await expect(page.locator('.trace-token[title="U+200C"]')).toHaveText('نیم‌فاصله');
});

test('compares the same input and refreshes after edits', async ({ page }) => {
  await page.getByLabel('متنِ شما', { exact: true }).fill('سلام سلام دنیا');
  await page.getByRole('tab', { name: 'مقایسهٔ روش‌ها', exact: true }).click();
  await expect(page.locator('.comparison-card')).toHaveCount(4);
  await expect(page.locator('.comparison-card').first()).toContainText('۳ توکن');
  await page.getByLabel('متنِ شما', { exact: true }).fill('کتاب');
  await page.getByRole('button', { name: /اجرای دوباره/ }).click();
  await expect(page.locator('.comparison-card')).toHaveCount(4);
  await expect(page.locator('.comparison-card').first()).toContainText('۱ توکن');
});

test('keeps the mobile viewport free of horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel('متنِ شما', { exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBeTruthy();
  await page.getByRole('tab', { name: 'راهنمای مفاهیم', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'توکن با واژه یکی نیست' })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBeTruthy();
});

test('ignores an older comparison response after the input changes', async ({ page }) => {
  let releaseOldResponse!: () => void;
  let markOldResponseReady!: () => void;
  const oldResponseGate = new Promise<void>((resolve) => {
    releaseOldResponse = resolve;
  });
  const oldResponseReady = new Promise<void>((resolve) => {
    markOldResponseReady = resolve;
  });
  let requests = 0;
  await page.route('**/api/compare', async (route) => {
    requests += 1;
    if (requests === 1) {
      const response = await route.fetch();
      markOldResponseReady();
      await oldResponseGate;
      await route.fulfill({ response });
    } else {
      await route.continue();
    }
  });
  try {
    await page.getByLabel('متنِ شما', { exact: true }).fill('سلام سلام دنیا');
    await page.getByRole('tab', { name: 'مقایسهٔ روش‌ها', exact: true }).click();
    await oldResponseReady;
    await page.getByLabel('متنِ شما', { exact: true }).fill('کتاب');
    await page.getByRole('button', { name: /اجرای دوباره/ }).click();
    await expect(page.locator('.comparison-card').first()).toContainText('۱ توکن');
    const oldResponseDelivered = page.waitForResponse('**/api/compare');
    releaseOldResponse();
    await oldResponseDelivered;
    await expect(page.locator('.comparison-card').first()).toContainText('۱ توکن');
  } finally {
    releaseOldResponse();
  }
});
