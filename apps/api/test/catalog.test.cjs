const { beforeAll, afterAll, test, expect } = require('@jest/globals');
const { randomUUID } = require('node:crypto');
const { URL } = require('node:url');
const { createApplication } = require('../dist/application');
const { PrismaService } = require('../dist/prisma/prisma.service');
const { hashPassword } = require('../dist/auth/password');

let app, db, base, admin, customer;
const password = randomUUID();
async function call(method, path, body, cookie = '', csrf = true) {
  const headers = { 'Content-Type': 'application/json', Cookie: cookie };
  if (csrf)
    Object.assign(headers, {
      Origin: 'http://localhost:3000',
      'X-BookingHub-CSRF': '1',
    });
  const response = await fetch(base + path, {
    method,
    headers,
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    body: await response.json(),
    cookie: response.headers.get('set-cookie')?.split(';')[0],
  };
}
async function login(email) {
  const result = await call('POST', '/auth/login', { email, password });
  expect(result.status).toBe(200);
  return result.cookie;
}
beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL);
  if (
    process.env.NODE_ENV !== 'test' ||
    url.hostname !== '127.0.0.1' ||
    url.pathname !== '/bookinghub_integration'
  )
    throw new Error('Cần PostgreSQL test riêng.');
  app = await createApplication();
  await app.listen(0, '127.0.0.1');
  db = app.get(PrismaService);
  base = (await app.getUrl()) + '/api/v1';
  const passwordHash = await hashPassword(password);
  for (const role of ['ADMIN', 'CUSTOMER']) {
    const email = randomUUID() + '@example.test';
    await db.user.create({
      data: { email, role, displayName: role, passwordHash },
    });
    if (role === 'ADMIN') admin = await login(email);
    else customer = await login(email);
  }
});
afterAll(async () => {
  if (app) await app.close();
});
const service = {
  name: 'Cắt tóc',
  description: 'Tạo kiểu',
  priceVnd: 120000,
  durationMinutes: 35,
};
async function createService(data = service) {
  const r = await call('POST', '/admin/services', data, admin);
  expect(r.status).toBe(201);
  return r.body;
}
async function createStaff() {
  const r = await call(
    'POST',
    '/admin/staff',
    {
      displayName: 'Thợ An',
      email: randomUUID() + '@example.test',
      password,
      bio: 'Tạo kiểu',
    },
    admin,
  );
  expect(r.status).toBe(201);
  return r.body;
}
test('admin cần phiên, vai trò và CSRF; STAFF đăng nhập được nhưng không quản trị', async () => {
  const member = await createStaff();
  const staff = await login(member.email);
  expect((await call('GET', '/admin/staff')).status).toBe(401);
  for (const cookie of [customer, staff]) {
    expect(
      (await call('GET', '/admin/services', undefined, cookie)).status,
    ).toBe(403);
    expect(
      (await call('POST', '/admin/services', service, cookie)).status,
    ).toBe(403);
  }
  expect(
    (await call('POST', '/admin/services', service, admin, false)).status,
  ).toBe(403);
});
test('DTO chặn giá, thời lượng và thuộc tính tài khoản sai', async () => {
  for (const field of [
    { priceVnd: -1 },
    { priceVnd: 10000001 },
    { priceVnd: 1.5 },
    { priceVnd: '1000' },
    { durationMinutes: 0 },
    { durationMinutes: 481 },
    { durationMinutes: 1.1 },
    { name: ' ' },
  ]) {
    expect(
      (await call('POST', '/admin/services', { ...service, ...field }, admin))
        .status,
    ).toBe(400);
  }
  const minimum = await createService({
    ...service,
    priceVnd: 0,
    durationMinutes: 1,
  });
  const edit = '/admin/services/' + minimum.id;
  for (const invalid of [{ priceVnd: null }, { active: 'false' }, {}])
    expect((await call('PATCH', edit, invalid, admin)).status).toBe(400);
  expect(
    (
      await call(
        'PATCH',
        edit,
        { priceVnd: 10000000, durationMinutes: 480 },
        admin,
      )
    ).status,
  ).toBe(200);
  const payload = {
    email: randomUUID() + '@example.test',
    displayName: 'Nhân viên',
    password,
  };
  for (const field of [{ role: 'ADMIN' }, { passwordHash: 'hash' }])
    expect(
      (await call('POST', '/admin/staff', { ...payload, ...field }, admin))
        .status,
    ).toBe(400);
  expect((await call('POST', '/admin/staff', payload, admin)).status).toBe(201);
  expect((await call('POST', '/admin/staff', payload, admin)).status).toBe(409);
  const other = await db.user.findFirstOrThrow({ where: { role: 'CUSTOMER' } });
  await expect(
    db.staffProfile.create({ data: { userId: other.id } }),
  ).rejects.toThrow();
});
test('phân trang, tìm theo tên, sort whitelist và dữ liệu công khai', async () => {
  const prefix = randomUUID();
  for (const priceVnd of [900, 100, 400])
    await createService({ ...service, name: prefix, priceVnd });
  const path = '/services?q=' + prefix + '&sort=priceVnd&order=desc&pageSize=2';
  const first = (await call('GET', path)).body,
    second = (await call('GET', path + '&page=2')).body;
  expect(first.items.map((s) => s.priceVnd)).toEqual([900, 400]);
  expect(first.hasNext).toBe(true);
  expect(second.items.map((s) => s.priceVnd)).toEqual([100]);
  expect(second.hasNext).toBe(false);
  const detail = await call('GET', '/services/' + first.items[0].id);
  expect(detail.body).toEqual(first.items[0]);
  expect(Object.keys(detail.body).sort()).toEqual([
    'description',
    'durationMinutes',
    'id',
    'name',
    'priceVnd',
  ]);
  for (const query of [
    'pageSize=51',
    'page=0',
    'pageSize=1.5',
    'order=random',
    'sort=passwordHash',
    'extra=1',
  ])
    expect((await call('GET', '/services?' + query)).status).toBe(400);
});
test('phân công nguyên tử, trùng/UUID không tồn tại và hai lần sửa đồng thời', async () => {
  const member = await createStaff();
  const left = await createService(),
    right = await createService();
  const path = '/admin/staff/' + member.id + '/services';
  const assign = (ids) => call('PUT', path, { serviceIds: ids }, admin);
  expect((await assign([left.id])).status).toBe(200);
  expect((await assign([left.id, left.id.toUpperCase()])).status).toBe(400);
  expect((await assign([right.id, randomUUID()])).status).toBe(404);
  const assigned = () =>
    db.staffService.findMany({ where: { staffId: member.id } });
  expect((await assigned()).map((a) => a.serviceId)).toEqual([left.id]);
  await expect(
    db.staffService.create({
      data: { staffId: member.id, serviceId: left.id },
    }),
  ).rejects.toThrow();
  const both = await Promise.all([assign([left.id]), assign([right.id])]);
  expect(both.map((r) => r.status)).toEqual([200, 200]);
  expect(await assigned()).toHaveLength(1);
  expect((await assign([])).body.serviceIds).toEqual([]);
});
test('chỉ hiện nhân viên được phân công còn active; tắt trạng thái vẫn bảo toàn dữ liệu', async () => {
  const member = await createStaff(),
    unassigned = await createStaff(),
    cut = await createService();
  const adminPath = '/admin/staff/' + member.id;
  await call('PUT', adminPath + '/services', { serviceIds: [cut.id] }, admin);
  const path = '/services/' + cut.id + '/staff';
  expect((await call('GET', path + '?q=Thợ&pageSize=1')).body.items).toEqual([
    { id: member.id, displayName: member.displayName, bio: member.bio },
  ]);
  expect((await call('GET', path + '?sort=email')).status).toBe(400);
  expect(
    (
      await call(
        'PATCH',
        adminPath,
        { displayName: 'An mới', bio: 'Salon', active: false },
        admin,
      )
    ).status,
  ).toBe(200);
  expect((await call('GET', path)).body.items).toEqual([]);
  expect(
    (await call('POST', '/auth/login', { email: member.email, password }))
      .status,
  ).toBe(401);
  await call('PATCH', adminPath, { active: true }, admin);
  expect((await call('GET', path)).body.items).toEqual([
    { id: member.id, displayName: 'An mới', bio: 'Salon' },
  ]);
  expect(unassigned.id).not.toBe(member.id);
  await call('PATCH', '/admin/services/' + cut.id, { active: false }, admin);
  expect((await call('GET', '/services/' + cut.id)).status).toBe(404);
  expect((await call('GET', path)).status).toBe(404);
  expect(
    await db.staffService.count({
      where: { staffId: member.id, serviceId: cut.id },
    }),
  ).toBe(1);
  expect(
    (await call('GET', '/admin/staff?q=An%20mới', undefined, admin)).body
      .items[0].serviceIds,
  ).toContain(cut.id);
});
