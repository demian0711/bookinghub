const assert = require('node:assert/strict');
const { mkdtempSync, cpSync, mkdirSync, rmSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');
const { createServer } = require('node:http');
const { randomUUID } = require('node:crypto');
const { URL } = require('node:url');
const { once } = require('node:events');
const { createApplication } = require('../dist/application');
const { PrismaService } = require('../dist/prisma/prisma.service');
async function run() {
  const dbUrl = new URL(process.env.DATABASE_URL);
  assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(dbUrl.hostname, '127.0.0.1');
  assert.equal(dbUrl.pathname, '/bookinghub_integration');
  const webDir = resolve('../web');
  const webRequire = createRequire(join(webDir, 'package.json'));
  // Bản build riêng dùng cổng ngẫu nhiên và proxy thật, độc lập với phiên pnpm dev của người dùng.
  const tempRoot = join(webDir, '.next');
  mkdirSync(tempRoot, { recursive: true });
  const project = mkdtempSync(join(tempRoot, 'account-test-'));
  const server = createServer();
  let api, web, browser;
  try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const origin = 'http://127.0.0.1:' + server.address().port;
    process.env.WEB_ORIGIN = origin;
    api = await createApplication();
    await api.listen(0, '127.0.0.1');
    process.env.API_ORIGIN = await api.getUrl();
    for (const path of [
      'app',
      'components',
      'lib',
      'public',
      'package.json',
      'next.config.ts',
      'postcss.config.mjs',
      'tsconfig.json',
    ])
      cpSync(join(webDir, path), join(project, path), { recursive: true });
    execFileSync(
      process.execPath,
      [webRequire.resolve('next/dist/bin/next'), 'build', '--webpack'],
      {
        cwd: project,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          NEXT_TELEMETRY_DISABLED: '1',
        },
        stdio: 'inherit',
      },
    );
    web = webRequire('next')({ dir: project, dev: false });
    await web.prepare();
    server.on('request', web.getRequestHandler());
    if (process.argv.includes('--e2e')) {
      const { runBookingTests } = require('./run-booking-e2e.cjs');
      await runBookingTests({
        db: api.get(PrismaService),
        origin,
        webDir,
        webRequire,
      });
      return;
    }
    const { chromium } = webRequire('playwright');
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    page.setDefaultTimeout(15000);
    await page.goto(origin);
    await page.getByRole('heading', { level: 1 }).waitFor();
    assert.ok(
      await page
        .locator('.hero-photo img')
        .evaluate((img) => img.complete && img.naturalWidth > 0),
    );
    assert.ok(
      await page
        .locator('html')
        .evaluate((root) => root.scrollWidth <= root.clientWidth),
    );
    await page.getByRole('link', { name: 'Đặt lịch salon' }).click();
    await page.getByText('Salon chưa có dịch vụ để hiển thị.').waitFor();
    const service = await api.get(PrismaService).service.create({
      data: {
        name: 'Tạo kiểu thử',
        description: 'Tạo kiểu tóc',
        durationMinutes: 45,
        priceVnd: 250000,
      },
    });
    await page.reload();
    await page.getByRole('link', { name: /Tạo kiểu thử/ }).click();
    await page.getByRole('heading', { name: service.name }).waitFor();
    const destination = '/dich-vu/' + service.id;
    const password = randomUUID(),
      email = randomUUID() + '@example.test';
    await page.goto(origin + '/tai-khoan');
    await page.waitForURL('**/dang-nhap?**');
    await page.goto(
      origin + '/dang-ky?next=' + encodeURIComponent(destination),
    );
    await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
    assert.equal(await page.locator('input:invalid').count(), 3);
    await page.getByLabel('Tên hiển thị').fill('Khách kiểm thử');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Mật khẩu', { exact: true }).fill('ngắn');
    assert.equal(
      await page
        .locator('#password')
        .evaluate((input) => input.validity.tooShort),
      true,
    );
    await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
    await page.getByText('Đã tạo tài khoản.', { exact: false }).waitFor();
    async function login(value) {
      await page.getByLabel('Email', { exact: true }).fill(email);
      await page.getByLabel('Mật khẩu', { exact: true }).fill(value);
      await page.getByRole('button', { name: 'Đăng nhập' }).click();
    }
    await login('mat-khau-sai-123');
    await page
      .getByRole('alert')
      .getByText('Email hoặc mật khẩu chưa đúng.')
      .waitFor();
    await login(password);
    await page.waitForURL(origin + destination);
    await page.goto(origin + '/tai-khoan');
    await page.getByText(email, { exact: true }).waitFor();
    await page.reload();
    await page.getByText(email, { exact: true }).waitFor();
    const guest = await browser.newContext();
    try {
      const separate = await guest.newPage();
      await separate.goto(origin + '/tai-khoan');
      await separate.waitForURL('**/dang-nhap?**');
      assert.equal(await separate.getByText(email).count(), 0);
    } finally {
      await guest.close();
    }
    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await page.waitForURL(origin + '/');
    await page.goto(origin + '/tai-khoan');
    await page.waitForURL('**/dang-nhap?**');
    await page.goto(
      origin +
        '/dang-nhap?next=' +
        encodeURIComponent('https://example.invalid/'),
    );
    await login(password);
    await page.waitForURL(origin + '/tai-khoan');
    await page.getByText(email, { exact: true }).waitFor();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(origin);
    await page.getByRole('link', { name: /Tạo kiểu thử/ }).waitFor();
    process.stdout.write(
      'Chrome: danh mục, mobile, validation, đăng ký, đăng nhập, reload, cách ly phiên, đăng xuất và đường dẫn quay lại đều đạt.\n',
    );
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    if (web) await web.close();
    if (api) await api.close();
    rmSync(project, { recursive: true, force: true });
  }
}
run().catch((error) => {
  process.stderr.write(String(error) + '\n');
  process.exitCode = 1;
});
