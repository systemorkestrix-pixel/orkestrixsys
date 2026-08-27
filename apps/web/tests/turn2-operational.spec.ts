import { expect, test } from '@playwright/test';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/admin/login');
  await page.locator('input[type="email"]').fill('admin@orkestrix.test');
  await page.locator('input[type="password"]').fill('e2e-admin-password-2026');
  await page.getByRole('button', { name: 'دخول' }).click();
  await expect(page.getByRole('heading', { name: 'لوحة المتابعة' })).toBeVisible();
}

test('admin routes are protected by a server session', async ({ page }) => {
  await page.goto('/admin/services');
  await expect(page.getByRole('heading', { name: 'غير مصرح' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'تسجيل الدخول' })).toHaveAttribute('href', '/admin/login');
});

test('admin can authenticate, view operational counts, and logout', async ({ page }) => {
  await login(page);
  await expect(page.getByText('خدمات منشورة')).toBeVisible();
  await expect(page.getByText('مشاريع منشورة')).toBeVisible();
  await page.getByRole('button', { name: 'تسجيل الخروج' }).click();
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();
});

test('published project details are served from the database', async ({ page }) => {
  await page.goto('/projects/orkestrix-systems-site');
  await expect(page.getByRole('heading', { name: 'موقع Orkestrix Systems' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'السياق' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'النتيجة وحدودها' })).toBeVisible();
});

test('invalid project slugs return the public 404 experience', async ({ page }) => {
  await page.goto('/projects/not-a-published-project');
  await expect(page.locator('.not-found-code')).toHaveText('404');
});

test('contact request is saved before success and appears in admin leads', async ({ page }) => {
  const unique = Date.now();
  await page.goto('/contact');
  await page.locator('input').nth(0).fill(`مستخدم تشغيل ${unique}`);
  await page.locator('input').nth(1).fill('نشاط تشغيل');
  await page.locator('select').nth(0).selectOption({ label: 'نظام مخصص' });
  await page.locator('select').nth(1).selectOption({ label: 'البريد الإلكتروني' });
  await page.locator('input[placeholder]').fill(`ops-${unique}@example.com`);
  await page.locator('textarea').fill('هذا طلب تشغيل حقيقي لاختبار الحفظ المؤكد في قاعدة البيانات.');
  await page.getByRole('button', { name: /إرسال طلب المشروع/ }).click();
  await expect(page.locator('.contact-success')).toBeVisible();
  await expect(page.locator('.contact-success strong')).not.toBeEmpty();

  await login(page);
  await page.goto('/admin/leads');
  await page.locator('input[type="search"]').fill(`ops-${unique}@example.com`);
  await expect(page.getByText(`مستخدم تشغيل ${unique}`)).toBeVisible();
});
