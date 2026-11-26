import { expect, test, type Page } from '@playwright/test';
const fixture = () =>
  JSON.parse(process.env.E2E_STAFF_CASES!) as {
    day: string;
    future: string;
    foreign: string;
    past: string;
    ongoing: string;
  };
async function login(page: Page, email: string, path = '/staff') {
  await page.goto('/dang-nhap?next=' + encodeURIComponent(path));
  await page.getByLabel('Email', { exact: true }).fill(email + '@example.test');
  await page
    .getByLabel('Mật khẩu', { exact: true })
    .fill(process.env.E2E_PASSWORD!);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.waitForURL((url) => url.pathname === path);
}
async function act(page: Page, label: string, reason?: string) {
  await page.getByRole('button', { name: label, exact: true }).click();
  const dialog = page.getByRole('dialog');
  if (reason) {
    await expect(
      dialog.getByRole('button', { name: 'Lưu thay đổi' }),
    ).toBeDisabled();
    await dialog.getByLabel('Lý do hủy').fill(reason);
  }
  await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(dialog).not.toBeVisible();
}
function change(page: Page, id: string, status: string) {
  return page.request.patch('/api/v1/staff/appointments/' + id + '/status', {
    headers: { Origin: process.env.E2E_ORIGIN!, 'X-BookingHub-CSRF': '1' },
    data: { expectedStatus: 'PENDING', status },
  });
}
test('nhân viên lọc lịch được giao, xử lý xung đột, hủy có lý do và đọc lại sau reload', async ({
  page,
}) => {
  const f = fixture();
  await page.setViewportSize({ width: 320, height: 720 });
  await login(page, 'staff-an');
  await page.getByLabel('Ngày tại salon').fill(f.day);
  await page.getByLabel('Trạng thái').selectOption('PENDING');
  await page.getByRole('button', { name: 'Xem lịch' }).click();
  await page.getByRole('link', { name: /Cắt tóc buổi sáng/ }).waitFor();
  await expect(page.getByText('Lịch riêng của Bình')).toHaveCount(0);
  await page.getByRole('link', { name: /Cắt tóc buổi sáng/ }).click();
  await expect(
    page.getByText('Khách thử vận hành', { exact: true }),
  ).toBeVisible();
  expect(
    await page
      .locator('html')
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page.getByRole('button', { name: 'Hủy lịch', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Hủy lịch', exact: true }),
  ).toBeFocused();
  const payload = await (
    await page.request.get('/api/v1/staff/appointments/' + f.future)
  ).json();
  expect(Object.keys(payload.customer)).toEqual(['displayName']);
  expect(payload).not.toHaveProperty('customerId');
  // Một request khác xác nhận trước khi nhân viên lưu màn hình đang mở.
  expect((await change(page, f.future, 'CONFIRMED')).status()).toBe(204);
  const conflict = page.waitForResponse(
    (r) => r.request().method() === 'PATCH' && r.url().endsWith('/status'),
  );
  await act(page, 'Xác nhận lịch');
  expect((await conflict).status()).toBe(409);
  await expect(page.getByText(/Lịch vừa thay đổi/)).toBeVisible();
  await expect(page.locator('dd').getByText('Đã xác nhận')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hoàn thành' })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Ghi nhận không đến' }),
  ).toHaveCount(0);
  await act(page, 'Hủy lịch', 'Khách yêu cầu đổi ngày');
  await expect(page.locator('dd').getByText('Đã hủy')).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Khách yêu cầu đổi ngày/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Hủy lịch', exact: true }),
  ).toHaveCount(0);
});
test('hoàn thành và không đến theo mốc giờ của lịch được giao', async ({
  page,
}) => {
  const f = fixture();
  await page.clock.setFixedTime(new Date('2042-01-01T12:00:00Z'));
  await login(page, 'staff-an', '/staff/' + f.ongoing);
  await expect(page.getByRole('button', { name: 'Hoàn thành' })).toHaveCount(0);
  await act(page, 'Ghi nhận không đến');
  await expect(page.locator('dd').getByText('Không đến')).toBeVisible();
  await page.goto('/staff/' + f.past);
  await act(page, 'Hoàn thành');
  await page.reload();
  await expect(page.locator('dd').getByText('Đã hoàn thành')).toBeVisible();
});
test('lịch ngoài phân công và khu vực nhân viên được bảo vệ cả khi truy cập trực tiếp', async ({
  page,
}) => {
  const f = fixture();
  await page.goto('/staff/' + f.foreign);
  await expect(
    page.getByRole('main').getByRole('link', { name: 'Đăng nhập' }),
  ).toBeVisible();
  await login(page, 'staff-an', '/staff/' + f.foreign);
  await expect(
    page.getByText('Không tìm thấy lịch hẹn được giao.'),
  ).toBeVisible();
  expect((await change(page, f.foreign, 'CONFIRMED')).status()).toBe(404);
  await login(page, 'mai', '/staff/' + f.foreign);
  await expect(
    page.getByText(/Khu vực này chỉ dành cho nhân viên/),
  ).toBeVisible();
  expect(
    (
      await page.request.get('/api/v1/staff/appointments/' + f.foreign)
    ).status(),
  ).toBe(403);
  expect((await change(page, f.foreign, 'CONFIRMED')).status()).toBe(403);
  await page.goto('/staff');
  await expect(
    page.getByText(/Khu vực này chỉ dành cho nhân viên/),
  ).toBeVisible();
});
test('nhân viên xác nhận lịch của chính mình và giữ kết quả sau reload', async ({
  page,
}) => {
  await login(page, 'staff-binh', '/staff/' + fixture().foreign);
  await act(page, 'Xác nhận lịch');
  await expect(page.locator('dd').getByText('Đã xác nhận')).toBeVisible();
  await page.reload();
  await expect(page.locator('dd').getByText('Đã xác nhận')).toBeVisible();
});
