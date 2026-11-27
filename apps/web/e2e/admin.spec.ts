import { expect, test, type Page } from '@playwright/test';
const day = process.env.E2E_REPORT_DAY!;
const bookingDay = process.env.E2E_ADMIN_DAY!;
async function signIn(page: Page, role: 'admin-e2e' | 'mai' | 'staff-an') {
  const tokens = JSON.parse(process.env.E2E_ADMIN_SESSIONS!) as Record<
    string,
    string
  >;
  await page.context().addCookies([
    {
      name: 'bookinghub_session',
      value: tokens[role],
      domain: '127.0.0.1',
      path: '/api/v1',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ]);
}
test('khách và nhân viên bị chặn ở trang và API quản trị', async ({ page }) => {
  for (const role of ['mai', 'staff-an'] as const) {
    await signIn(page, role);
    await page.goto('/admin');
    await expect(page.getByText(/chỉ dành cho quản trị viên/)).toBeVisible();
    for (const route of [
      'services',
      'staff',
      'dashboard?from=' + day + '&to=' + day,
      'appointments?from=' + day + '&to=' + day,
    ])
      expect((await page.request.get('/api/v1/admin/' + route)).status()).toBe(
        403,
      );
    expect(
      (
        await page.request.post('/api/v1/admin/services', {
          headers: {
            Origin: process.env.E2E_ORIGIN!,
            'X-BookingHub-CSRF': '1',
          },
          data: { name: 'Bị chặn' },
        })
      ).status(),
    ).toBe(403);
  }
});
test('dashboard khớp bản chụp, mốc ngày salon và danh sách liên kết', async ({
  page,
}) => {
  await signIn(page, 'admin-e2e');
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/admin');
  await page.getByLabel('Từ ngày').fill(day);
  await page.getByLabel('Đến ngày').fill(day);
  await page.getByRole('button', { name: 'Áp dụng' }).click();
  await expect(page.locator('.metric-grid')).toContainText('300.000');
  await expect(page.locator('.metric-grid')).toContainText('25%');
  await expect(
    page.getByRole('link', { name: 'Đã hoàn thành · 2', exact: true }),
  ).toBeVisible();
  expect(
    await page
      .locator('html')
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  const report = await (
    await page.request.get('/api/v1/admin/dashboard?from=' + day + '&to=' + day)
  ).json();
  expect(report).toMatchObject({
    total: 4,
    counts: {
      COMPLETED: 2,
      PENDING: 1,
      CANCELLED: 1,
      CONFIRMED: 0,
      NO_SHOW: 0,
    },
    completedValue: 300000,
    cancellationRate: 0.25,
    popular: [{ count: 2 }],
  });
  const empty = await (
    await page.request.get(
      '/api/v1/admin/dashboard?from=2000-01-01&to=2000-01-01',
    )
  ).json();
  expect(empty).toMatchObject({
    total: 0,
    cancellationRate: null,
    popular: [],
  });
  expect(
    (
      await page.request.get(
        '/api/v1/admin/dashboard?from=2000-01-01&to=2001-01-01',
      )
    ).status(),
  ).toBe(400);
  await page.getByRole('link', { name: 'Đối chiếu toàn bộ lịch →' }).click();
  await expect(page.getByText('4 lịch phù hợp')).toBeVisible();
  await page.locator('.appointment-list a').first().click();
  await page.getByRole('link', { name: '← Quay lại danh sách lịch' }).click();
  await expect(page.getByLabel('Từ ngày')).toHaveValue(day);
  await expect(page.getByLabel('Đến ngày')).toHaveValue(day);
  await expect(page.getByText('4 lịch phù hợp')).toBeVisible();
  await page.goto('/admin?from=' + day + '&to=' + day);
  await page
    .getByRole('link', { name: 'Đã hoàn thành · 2', exact: true })
    .click();
  await expect(page.getByText('2 lịch phù hợp')).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel('Từ ngày')).toHaveValue(day);
  await page.reload();
  await expect(page.locator('.metric-grid')).toContainText('300.000');
});
test('admin quản lý danh mục, ca nghỉ, xử lý 409 và khách vẫn đặt được', async ({
  page,
  browser,
  baseURL,
}) => {
  await signIn(page, 'admin-e2e');
  page.on('dialog', (d) => d.accept());
  await page.goto('/admin/dich-vu');
  await page.getByText('Thêm dịch vụ', { exact: true }).click();
  await page
    .getByLabel('Tên dịch vụ')
    .filter({ visible: true })
    .fill('Gội thảo mộc');
  await page.getByLabel('Giá (VND)').filter({ visible: true }).fill('130000');
  await page
    .getByLabel('Thời lượng (phút)')
    .filter({ visible: true })
    .fill('45');
  await page.getByRole('button', { name: 'Tạo dịch vụ', exact: true }).click();
  await page.getByText(/^Gội thảo mộc ·/).click();
  await page.getByLabel('Giá (VND)').filter({ visible: true }).fill('150000');
  await page.getByRole('button', { name: 'Lưu dịch vụ' }).click();
  await expect(page.getByText(/Gội thảo mộc · 150.000/)).toBeVisible();
  await page.goto('/admin/nhan-vien');
  await page.getByText('Thêm nhân viên', { exact: true }).click();
  await page.getByLabel('Tên nhân viên').filter({ visible: true }).fill('Ngọc');
  await page
    .getByLabel('Email', { exact: true })
    .filter({ visible: true })
    .fill('ngoc@example.test');
  await page
    .getByLabel('Mật khẩu ban đầu')
    .filter({ visible: true })
    .fill(process.env.E2E_PASSWORD!);
  await page.getByRole('button', { name: 'Tạo nhân viên' }).click();
  const employee = page
    .locator('details')
    .filter({ hasText: 'ngoc@example.test' });
  await employee.locator('summary').click();
  await employee.getByLabel('Giới thiệu').fill('Chăm sóc tóc');
  await employee.getByRole('button', { name: 'Lưu hồ sơ' }).click();
  await expect(employee).not.toHaveAttribute('open', '');
  await employee.locator('summary').click();
  await employee.getByLabel('Gội thảo mộc').check();
  await employee.getByRole('button', { name: 'Lưu phân công' }).click();
  await expect(employee).not.toHaveAttribute('open', '');
  await employee.locator('summary').click();
  await employee.getByRole('link', { name: 'Quản lý ca làm' }).click();
  const weekday = new Date(bookingDay + 'T12:00:00Z').getUTCDay() || 7;
  await page.getByLabel('Thứ trong tuần').selectOption(String(weekday));
  await page.getByRole('button', { name: 'Thêm ca', exact: true }).click();
  await page.getByRole('button', { name: 'Thêm khoảng nghỉ' }).click();
  await page.getByRole('button', { name: 'Lưu ca làm' }).click();
  await expect(page.getByText('Đã lưu thay đổi.')).toBeVisible();
  await page.getByLabel('Ngày nghỉ mới').fill(bookingDay);
  await page.getByRole('button', { name: 'Thêm ngày nghỉ' }).click();
  await expect(
    page.getByRole('button', { name: 'Bỏ ngày nghỉ' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Bỏ ngày nghỉ' }).click();
  await expect(page.getByText('Chưa có ngày nghỉ.')).toBeVisible();
  const client = await browser.newPage({ baseURL, ignoreHTTPSErrors: true });
  try {
    await signIn(client, 'mai');
    await client.goto('/dich-vu');
    await client.getByRole('link', { name: /Gội thảo mộc/ }).click();
    await client.getByRole('link', { name: 'Chọn nhân viên và giờ' }).click();
    await client
      .getByLabel('Nhân viên', { exact: true })
      .selectOption({ label: 'Ngọc' });
    await client.getByLabel('Ngày hẹn').fill(bookingDay);
    await client.getByRole('button', { name: '09:00', exact: true }).click();
    await client.getByRole('button', { name: 'Tiếp tục' }).click();
    await client.getByRole('button', { name: 'Xác nhận đặt lịch' }).click();
    await expect(client.getByText('Đặt lịch thành công')).toBeVisible();
    await expect(client.getByText(/150.000/)).toBeVisible();
  } finally {
    await client.close();
  }
  await page.getByRole('button', { name: 'Bỏ ca', exact: true }).click();
  await page.getByRole('button', { name: 'Lưu ca làm' }).click();
  await expect(page.getByText(/ảnh hưởng các lịch đang giữ chỗ/)).toBeVisible();
  await page.getByRole('link', { name: /Xử lý lịch/ }).click();
  await page
    .getByRole('button', { name: 'Xác nhận lịch', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Lưu thay đổi' })
    .click();
  await expect(page.locator('dd').getByText('Đã xác nhận')).toBeVisible();
  await page.goto('/admin/dich-vu');
  await page.getByText(/^Gội thảo mộc ·/).click();
  await page.getByLabel('Đang hoạt động').filter({ visible: true }).uncheck();
  await page.getByRole('button', { name: 'Lưu dịch vụ' }).click();
  await expect(page.getByText(/Gội thảo mộc · .*Đã ngừng/)).toBeVisible();
});
