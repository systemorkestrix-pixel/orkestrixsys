import { expect, test } from '@playwright/test';

const viewports = [
  { width: 320, height: 800 },
  { width: 375, height: 850 },
  { width: 430, height: 900 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1000 },
] as const;

const routes = ['/', '/services', '/projects', '/contact'] as const;

for (const viewport of viewports) {
  test.describe(`${viewport.width}px`, () => {
    test.use({ viewport });

    for (const route of routes) {
      test(`${route} renders without overflow or runtime errors`, async ({ page }) => {
        const runtimeErrors: string[] = [];
        page.on('pageerror', (error) => runtimeErrors.push(error.message));
        page.on('console', (message) => {
          if (message.type() === 'error') runtimeErrors.push(message.text());
        });

        await page.goto(route);
        await expect(page.locator('main')).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(1);
        expect(runtimeErrors).toEqual([]);
      });
    }
  });
}

test('unknown route displays the real 404 experience', async ({ page }) => {
  await page.goto('/route-that-does-not-exist');
  await expect(page.locator('.not-found-code')).toHaveText('404');
  await expect(page.locator('a.button[href="/"]')).toBeVisible();
  await expect(page.locator('a[href="/contact"]')).toBeVisible();
});

test('primary and secondary CTA destinations are consistent', async ({ page }) => {
  for (const route of routes) {
    await page.goto(route);
    for (const link of await page.locator('a').all()) {
      const label = (await link.textContent())?.replace(/\s+/g, ' ').trim();
      const href = await link.getAttribute('href');
      if (label?.includes('ابدأ مشروعك')) expect(href).toBe('/contact');
      if (label?.includes('استكشف أعمالنا')) expect(href).toBe('/projects');
    }
  }
});

test('projects filter exposes a truthful empty state', async ({ page }) => {
  await page.goto('/projects');
  await expect(page.locator('.project-featured')).toBeVisible();
  await expect(page.locator('.project-empty')).toHaveCount(0);
  await page.locator('.project-filter').filter({ hasText: 'المتاجر' }).click();
  await expect(page.locator('.project-empty')).toBeVisible();
  await expect(page.locator('.project-empty a[href="/contact"]')).toBeVisible();
});

test('contact form never claims success without a confirmed backend', async ({ page }) => {
  await page.route('**/api/public/leads', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'وجهة الاستقبال غير متاحة للاختبار.' }) }));
  await page.goto('/contact');
  await page.locator('input').nth(0).fill('مستخدم اختبار');
  await page.locator('input').nth(1).fill('نشاط اختبار');
  await page.locator('select').nth(0).selectOption({ label: 'موقع' });
  await page.locator('select').nth(1).selectOption({ label: 'البريد الإلكتروني' });
  await page.locator('input[placeholder]').fill('test@example.com');
  await page.locator('textarea').fill('نريد إنشاء موقع واضح لاختبار مسار الطلب.');
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('.contact-error')).toBeVisible();
  await expect(page.locator('.contact-success')).toHaveCount(0);
});

test('keyboard and interactive controls remain operable', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 850 });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();
  await page.locator('.mobile-menu-button').click();
  await expect(page.locator('.main-nav')).toHaveClass(/menu-open/);
  const faqButton = page.locator('.faq-item button').first();
  await expect(faqButton).toHaveAttribute('aria-expanded', 'true');
  await faqButton.click();
  await expect(faqButton).toHaveAttribute('aria-expanded', 'false');
  await faqButton.click();
  await expect(faqButton).toHaveAttribute('aria-expanded', 'true');
});
