const { beforeEach, afterEach, expect, test } = require('@jest/globals');
const { Module, Controller, Get } = require('@nestjs/common');
const { createHash, randomBytes } = require('node:crypto');
const { URL } = require('node:url');
const { execFileSync, spawnSync } = require('node:child_process');
const { createApplication } = require('../dist/application');
const { AppModule } = require('../dist/app.module');
const { PrismaService } = require('../dist/prisma/prisma.service');
const { Roles } = require('../dist/auth/guards');

// Endpoint dành riêng cho kiểm thử để chạy guard thật trước khi có nghiệp vụ admin ở milestone sau.
class AdminProbe {
  read() {
    return { ok: true };
  }
}
Controller('admin-test')(AdminProbe);
Roles('ADMIN')(AdminProbe);
Get()(
  AdminProbe.prototype,
  'read',
  Object.getOwnPropertyDescriptor(AdminProbe.prototype, 'read'),
);
class IntegrationModule {}
Module({ imports: [AppModule], controllers: [AdminProbe] })(IntegrationModule);

let app, db, base;
let credentials, signup;
const csrf = { Origin: 'http://localhost:3000', 'X-BookingHub-CSRF': '1' };
function post(path, body, headers = csrf, cookie = '') {
  return fetch(base + path, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  });
}
function get(path, cookie = '') {
  return fetch(base + path, { headers: { Cookie: cookie } });
}
async function login() {
  const result = await post('/auth/login', credentials);
  expect(result.status).toBe(200);
  const header = result.headers.get('set-cookie');
  expect(header).toMatch(/HttpOnly/i);
  expect(header).toMatch(/SameSite=Lax/i);
  expect(header).toMatch(/Path=\/api\/v1(?:;|$)/);
  expect(header).toMatch(/Expires=/);
  expect(header).not.toMatch(/; Secure/i);
  const user = await result.json();
  expect(Object.keys(user).sort()).toEqual([
    'displayName',
    'email',
    'id',
    'role',
  ]);
  return header.split(';')[0];
}
beforeEach(async () => {
  const url = new URL(process.env.DATABASE_URL);
  if (
    process.env.NODE_ENV !== 'test' ||
    url.hostname !== '127.0.0.1' ||
    url.pathname !== '/bookinghub_integration'
  )
    throw new Error('Chỉ chạy qua pnpm test:integration.');
  credentials = {
    email: randomBytes(8).toString('hex') + '@example.test',
    password: randomBytes(20).toString('hex'),
  };
  signup = { ...credentials, displayName: 'Member' };
  app = await createApplication(IntegrationModule);
  await app.listen(0, '127.0.0.1');
  db = app.get(PrismaService);
  base = (await app.getUrl()) + '/api/v1';
});
afterEach(async () => {
  if (app) await app.close();
});
test('CSRF kiểm tra origin cấu hình và header riêng kể cả trước đăng nhập', async () => {
  for (const headers of [
    { Origin: csrf.Origin },
    { 'X-BookingHub-CSRF': '1' },
    { ...csrf, Origin: 'null' },
    {
      ...csrf,
      Origin: 'https://other.example',
      'X-Forwarded-Host': 'other.example',
    },
  ]) {
    expect((await post('/auth/register', signup, headers)).status).toBe(403);
  }
});
test('đăng ký chỉ tạo CUSTOMER, chuẩn hóa email và không lộ mật khẩu', async () => {
  for (const role of ['STAFF', 'ADMIN'])
    expect((await post('/auth/register', { ...signup, role })).status).toBe(
      400,
    );
  const result = await post('/auth/register', {
    ...signup,
    email: '  ' + credentials.email.toUpperCase() + ' ',
  });
  expect(result.status).toBe(201);
  expect(await result.json()).toEqual({
    id: expect.any(String),
    email: credentials.email,
    role: 'CUSTOMER',
    displayName: 'Member',
  });
  expect((await post('/auth/register', signup)).status).toBe(409);
  const user = await db.user.findUniqueOrThrow({
    where: { email: credentials.email },
  });
  expect(user.passwordHash.startsWith('$argon2id$')).toBe(true);
});
test('sai mật khẩu, email chưa đăng ký và JSON lỗi đều có phản hồi an toàn', async () => {
  expect((await post('/auth/register', signup)).status).toBe(201);
  for (const email of [credentials.email, 'missing@example.test']) {
    const response = await post('/auth/login', {
      email,
      password: 'wrong-password-123',
    });
    expect(response.status).toBe(401);
    expect(Object.keys(await response.json()).sort()).toEqual([
      'error',
      'message',
      'statusCode',
    ]);
    expect(response.headers.has('set-cookie')).toBe(false);
  }
  const response = await fetch(base + '/auth/login', {
    method: 'POST',
    headers: { ...csrf, 'Content-Type': 'application/json' },
    body: '{"password":"secret_marker"',
  });
  expect(response.status).toBe(400);
  expect(await response.text()).not.toContain('secret_marker');
});
test('guard trả 401, 403 và dùng quyền hiện tại trong database', async () => {
  expect((await post('/auth/register', signup)).status).toBe(201);
  expect((await get('/auth/me')).status).toBe(401);
  expect((await get('/admin-test')).status).toBe(401);
  const cookie = await login();
  const profile = await get('/auth/me', cookie);
  expect(profile.status).toBe(200);
  expect(Object.keys(await profile.json()).sort()).toEqual([
    'displayName',
    'email',
    'id',
    'role',
  ]);
  expect((await get('/admin-test', cookie)).status).toBe(403);
  for (const role of ['STAFF', 'ADMIN', 'CUSTOMER']) {
    await db.user.update({
      where: { email: credentials.email },
      data: { role },
    });
    expect((await get('/admin-test', cookie)).status).toBe(
      role === 'ADMIN' ? 200 : 403,
    );
  }
});
test('logout chỉ thu hồi phiên hiện tại, chặn dùng lại cookie cũ', async () => {
  expect((await post('/auth/register', signup)).status).toBe(201);
  const first = await login(),
    second = await login();
  expect(first === second).toBe(false);
  expect((await post('/auth/logout', {}, {}, first)).status).toBe(403);
  const result = await post('/auth/logout', {}, csrf, first);
  expect(result.status).toBe(204);
  expect(result.headers.get('set-cookie')).toMatch(/^bookinghub_session=;/);
  expect((await get('/auth/me', first)).status).toBe(401);
  expect((await get('/auth/me', second)).status).toBe(200);
});
test('từ chối phiên hết hạn và tài khoản bị khóa', async () => {
  expect((await post('/auth/register', signup)).status).toBe(201);
  const cookie = await login();
  const tokenHash = createHash('sha256')
    .update(cookie.split('=')[1])
    .digest('hex');
  await db.session.update({
    where: { tokenHash },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  expect((await get('/auth/me', cookie)).status).toBe(401);
  const activeCookie = await login();
  await db.user.update({
    where: { email: credentials.email },
    data: { active: false },
  });
  expect((await get('/auth/me', activeCookie)).status).toBe(401);
  expect((await post('/auth/login', credentials)).status).toBe(401);
});
test('giới hạn cả đăng nhập và đăng ký bất kể forwarded headers', async () => {
  for (const path of ['/auth/login', '/auth/register']) {
    let status;
    for (let i = 0; i < 11; i++)
      status = (
        await post(path, {}, { ...csrf, 'X-Forwarded-For': `192.0.2.${i}` })
      ).status;
    expect(status).toBe(429);
  }
});
test('seed yêu cầu opt-in, từ chối production và chạy lại giữ nguyên tài khoản', async () => {
  const seedEnv = {
    ...process.env,
    NODE_ENV: 'development',
    ALLOW_DEMO_SEED: '1',
    DEMO_CUSTOMER_PASSWORD: credentials.password,
    DEMO_STAFF_PASSWORD: credentials.password,
    DEMO_ADMIN_PASSWORD: credentials.password,
  };
  for (const env of [
    { ...seedEnv, ALLOW_DEMO_SEED: '' },
    { ...seedEnv, NODE_ENV: 'production', WEB_ORIGIN: 'https://example.test' },
  ]) {
    expect(spawnSync(process.execPath, ['dist/seed.js'], { env }).status).toBe(
      1,
    );
  }
  const run = () =>
    execFileSync(process.execPath, ['dist/seed.js'], {
      env: seedEnv,
      stdio: 'pipe',
    });
  run();
  const users = () =>
    db.user.findMany({
      where: { email: { endsWith: '@demo.bookinghub.test' } },
      orderBy: { email: 'asc' },
    });
  const before = await users();
  expect(before.map((user) => user.role)).toEqual([
    'ADMIN',
    'CUSTOMER',
    'STAFF',
  ]);
  const staff = before.find((user) => user.role === 'STAFF');
  const services = await get(
    '/services/bedc0c0a-d5a3-483a-adcb-772ffc926c88/staff',
  );
  expect((await services.json()).items.map((person) => person.id)).toContain(
    staff.id,
  );
  await db.staffService.deleteMany({ where: { staffId: staff.id } });
  run();
  expect(await db.staffService.count({ where: { staffId: staff.id } })).toBe(0);
  expect(
    (await users()).every(
      (user, i) => user.passwordHash === before[i].passwordHash,
    ),
  ).toBe(true);
});
