import { expect, test, type Page } from '@playwright/test';
const day = process.env.E2E_DAY!,
  password = process.env.E2E_PASSWORD!;
async function login(page: Page, name: string) {
  await page.getByLabel('Email', { exact: true }).fill(name + '@example.test');
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
}
async function choose(page: Page, time: string) {
  await page.goto('/dich-vu');
  await page.getByRole('link', { name: /Chăm sóc tóc E2E/ }).click();
  await page.getByRole('link', { name: 'Chọn nhân viên và giờ' }).click();
  await page
    .getByLabel('Nhân viên', { exact: true })
    .selectOption({ label: 'An' });
  await page.getByLabel('Ngày hẹn').fill(day);
  await page.getByRole('button', { name: time, exact: true }).click();
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
}
async function confirm(page: Page) {
  const response = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      r.url().endsWith('/api/v1/appointments'),
  );
  await page.getByRole('button', { name: 'Xác nhận đặt lịch' }).click();
  return response;
}
test('khôi phục sau đăng nhập, tranh cùng giờ, xem và hủy lịch theo quyền', async ({
  page,
  browser,
  baseURL,
}) => {
  await choose(page, '09:00');
  await page.getByRole('link', { name: 'Đăng nhập để xác nhận' }).click();
  await login(page, 'mai');
  await expect(
    page.getByRole('heading', { name: 'Xác nhận lịch hẹn' }),
  ).toBeVisible();
  await expect(page.locator('.summary')).toContainText('09:00');
  const rival = await browser.newPage({ baseURL });
  try {
    await rival.goto('/dang-nhap');
    await login(rival, 'lan');
    await rival.waitForURL('**/tai-khoan');
    await choose(rival, '09:00');
    expect((await confirm(rival)).status()).toBe(201);
    await expect(rival.getByText('Đặt lịch thành công')).toBeVisible();
    expect((await confirm(page)).status()).toBe(409);
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      'vừa có người đặt',
    );
    await expect(
      page.getByRole('button', { name: '09:30', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: '09:00', exact: true }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: '09:30', exact: true }).click();
    await page.getByRole('button', { name: 'Tiếp tục' }).click();
    const accepted = await confirm(page);
    expect(accepted.status()).toBe(201);
    expect(Object.keys(accepted.request().postDataJSON()).sort()).toEqual([
      'serviceId',
      'staffId',
      'startAt',
    ]);
    await expect(page.getByText('Đặt lịch thành công')).toBeVisible();
    const own = page.url();
    await rival.goto(own);
    await expect(rival.getByText('Không tìm thấy lịch hẹn này.')).toBeVisible();
    await expect(rival.getByText('Giá khi đặt')).toHaveCount(0);
    await page.getByRole('link', { name: /← Lịch của tôi/ }).click();
    await page.getByLabel('Ngày hẹn').fill(day);
    await page.getByLabel('Trạng thái').selectOption('PENDING');
    await page.getByRole('link', { name: /Chăm sóc tóc E2E/ }).click();
    await expect(page.getByText('30 phút', { exact: true })).toBeVisible();
    await expect(page.getByText(/180.000/)).toBeVisible();
    await page.getByRole('button', { name: 'Hủy lịch', exact: true }).click();
    await page.getByRole('button', { name: 'Giữ lịch' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Hủy lịch', exact: true }).click();
    await page.getByRole('button', { name: 'Xác nhận hủy' }).click();
    await expect(page.getByRole('status')).toContainText('Đã hủy lịch hẹn');
    await choose(page, '09:30');
    await expect(
      page.getByRole('button', { name: 'Xác nhận đặt lịch' }),
    ).toBeVisible();
  } finally {
    await rival.close();
  }
});
test('đổi nhân viên hoặc ngày xóa giờ cũ và giờ mất trong lúc đăng nhập được kiểm tra lại', async ({
  page,
  browser,
  baseURL,
}) => {
  await choose(page, '10:30');
  await page
    .getByLabel('Nhân viên', { exact: true })
    .selectOption({ label: 'Bình' });
  await page.getByLabel('Ngày hẹn').fill(day);
  await expect(page.getByRole('button', { name: 'Tiếp tục' })).toBeDisabled();
  await page.getByRole('button', { name: '10:30', exact: true }).click();
  await page.getByLabel('Ngày hẹn').fill('');
  await page.getByLabel('Ngày hẹn').fill(day);
  await expect(page.getByRole('button', { name: 'Tiếp tục' })).toBeDisabled();
  await choose(page, '10:30');
  await page.getByRole('link', { name: 'Đăng nhập để xác nhận' }).click();
  const rival = await browser.newPage({ baseURL });
  try {
    await rival.goto('/dang-nhap');
    await login(rival, 'lan');
    await rival.waitForURL('**/tai-khoan');
    await choose(rival, '10:30');
    expect((await confirm(rival)).status()).toBe(201);
    await login(page, 'hoa');
    await expect(
      page.getByText('Giờ đã chọn không còn trống. Hãy chọn lại.'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Xác nhận đặt lịch' }),
    ).toHaveCount(0);
  } finally {
    await rival.close();
  }
});

test('trang hai hiển thị bản chụp và backend từ chối hủy lịch đã quá hạn', async ({
  page,
}) => {
  await page.goto('/dang-nhap?next=/lich-cua-toi');
  await login(page, 'vy');
  await expect(page.getByRole('link', { name: /Dịch vụ lúc đặt/ })).toHaveCount(
    5,
  );
  await page.getByRole('button', { name: 'Trang sau' }).click();
  const item = page.getByRole('link', { name: /Dịch vụ lúc đặt/ });
  await expect(item).toHaveCount(1);
  await item.click();
  await expect(page.getByText('45 phút', { exact: true })).toBeVisible();
  await expect(page.getByText(/120.000/)).toBeVisible();
  await page.getByRole('button', { name: 'Hủy lịch', exact: true }).click();
  const response = page.waitForResponse(
    (r) => r.request().method() === 'PATCH' && r.url().endsWith('/status'),
  );
  await page.getByRole('button', { name: 'Xác nhận hủy' }).click();
  expect((await response).status()).toBe(409);
  await expect(page.getByRole('status')).toContainText('còn dưới 2 giờ');
});
