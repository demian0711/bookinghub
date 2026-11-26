import { expect, test } from '@playwright/test';
test.describe('Gửi biểu mẫu HTML', () => {
  test.use({ javaScriptEnabled: false });
  test('biểu mẫu chưa hydrate giữ mật khẩu khỏi URL', async ({ page }) => {
    for (const [path, title] of [
      ['/dang-nhap', 'Đăng nhập'],
      ['/dang-ky', 'Tạo tài khoản'],
    ]) {
      await page.goto(path);
      if (path === '/dang-ky')
        await page.getByLabel('Tên hiển thị').fill('Khách thử');
      await page
        .getByLabel('Email', { exact: true })
        .fill('release@example.test');
      await page
        .getByLabel('Mật khẩu', { exact: true })
        .fill('mat-khau-kiem-thu');
      const request = page.waitForRequest((r) => r.isNavigationRequest());
      await page.getByRole('button', { name: title, exact: true }).click();
      const sent = await request;
      expect(sent.method()).toBe('POST');
      expect(new URL(sent.url()).search).toBe('');
    }
  });
});
test('khách đăng ký qua bản production cùng origin', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/dang-ky');
  await page.getByLabel('Tên hiển thị').fill('Khách phát hành');
  await page.getByLabel('Email', { exact: true }).fill('khach-m9@example.test');
  await page
    .getByLabel('Mật khẩu', { exact: true })
    .fill(process.env.E2E_PASSWORD!);
  const response = page.waitForResponse((r) =>
    r.url().endsWith('/api/v1/auth/register'),
  );
  await page
    .getByRole('button', { name: 'Tạo tài khoản', exact: true })
    .click();
  expect((await response).status()).toBe(201);
  await expect(page.getByRole('status')).toContainText('Đã tạo tài khoản');
});
