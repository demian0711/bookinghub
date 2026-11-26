const {
  beforeAll,
  beforeEach,
  afterAll,
  expect,
  test,
} = require('@jest/globals');
const { randomUUID } = require('node:crypto');
const { URL, URLSearchParams } = require('node:url');
const { Temporal } = require('@js-temporal/polyfill');
const { createApplication } = require('../dist/application');
const { PrismaService } = require('../dist/prisma/prisma.service');
const { hashPassword } = require('../dist/auth/password');
let app, db, base, customers, admin, service, staffId, day, passwordHash;
const zone = 'Asia/Ho_Chi_Minh';
async function http(method, path, body, cookie = '') {
  const r = await fetch(base + path, {
    method,
    headers: {
      Origin: 'http://localhost:3000',
      'X-BookingHub-CSRF': '1',
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify(body),
  });
  return {
    status: r.status,
    body: r.status === 204 ? null : await r.json(),
    cookie: r.headers.get('set-cookie')?.split(';')[0],
  };
}
async function user(role, password) {
  const email = randomUUID() + '@example.test';
  const row = await db.user.create({
    data: { email, role, displayName: role, passwordHash },
  });
  const r = await http('POST', '/auth/login', { email, password });
  expect(r.status).toBe(200);
  return { id: row.id, cookie: r.cookie };
}
async function staff() {
  const row = await db.staffProfile.create({
    data: {
      user: {
        create: {
          email: randomUUID() + '@example.test',
          displayName: 'Thợ',
          role: 'STAFF',
          passwordHash,
        },
      },
      assignments: { create: { serviceId: service.id } },
      workDays: {
        create: {
          weekday: day.dayOfWeek,
          shifts: {
            create: {
              startMinute: 540,
              endMinute: 720,
              breaks: { create: { startMinute: 660, endMinute: 675 } },
            },
          },
        },
      },
    },
  });
  return row.userId;
}
function payload(time = '09:00') {
  return {
    serviceId: service.id,
    staffId,
    startAt: day.toString() + 'T' + time + ':00+07:00',
  };
}
const book = (time = '09:00', cookie = customers[0].cookie, override = {}) =>
  http('POST', '/appointments', { ...payload(time), ...override }, cookie);
const preview = () =>
  http(
    'GET',
    '/availability?' +
      new URLSearchParams({
        staffId,
        serviceId: service.id,
        date: day.toString(),
      }),
  );
beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL);
  if (
    process.env.NODE_ENV !== 'test' ||
    url.hostname !== '127.0.0.1' ||
    url.pathname !== '/bookinghub_integration'
  )
    throw new Error('Cần database test riêng.');
  app = await createApplication();
  await app.listen(0, '127.0.0.1');
  db = app.get(PrismaService);
  base = (await app.getUrl()) + '/api/v1';
  const password = randomUUID();
  passwordHash = await hashPassword(password);
  customers = [
    await user('CUSTOMER', password),
    await user('CUSTOMER', password),
  ];
  admin = await user('ADMIN', password);
});
beforeEach(async () => {
  day = Temporal.Now.plainDateISO(zone).add({ days: 1 });
  service = await db.service.create({
    data: {
      name: 'Cắt thử',
      description: '',
      priceVnd: 100000,
      durationMinutes: 30,
    },
  });
  staffId = await staff();
});
afterAll(async () => {
  if (app) await app.close();
});
test('migration từ trống đã cài extension và exclusion constraint', async () => {
  const extension =
    await db.$queryRaw`SELECT extname FROM pg_extension WHERE extname='btree_gist'`;
  expect(extension).toHaveLength(1);
  const constraints =
    await db.$queryRaw`SELECT contype::text AS type FROM pg_constraint WHERE conname='appointment_staff_held_excl' AND conrelid='"Appointment"'::regclass`;
  expect(constraints).toEqual([{ type: 'x' }]);
});
test('hai khách đặt cùng lúc, đúng một lịch và một sự kiện tạo', async () => {
  const results = await Promise.all(
    customers.map((c) => book('09:00', c.cookie)),
  );
  expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  expect(results.find((r) => r.status === 409).body.code).toBe(
    'APPOINTMENT_SLOT_TAKEN',
  );
  const index = results.findIndex((r) => r.status === 201);
  const a = results[index].body;
  expect(a).toMatchObject({
    customerId: customers[index].id,
    status: 'PENDING',
    staffId,
    serviceId: service.id,
    priceVnd: 100000,
    durationMinutes: 30,
    serviceName: 'Cắt thử',
  });
  expect(new Date(a.endAt) - new Date(a.startAt)).toBe(30 * 60000);
  expect(await db.appointment.count({ where: { staffId } })).toBe(1);
  const events = await db.appointmentEvent.findMany({
    where: { appointmentId: a.id },
  });
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    status: 'PENDING',
    previousStatus: null,
    actorId: customers[index].id,
    occurredAt: expect.any(Date),
  });
});
test('trùng một phần, hai đầu nối tiếp và cùng giờ cho nhân viên khác', async () => {
  expect((await book('09:30')).status).toBe(201);
  for (const start of ['09:15', '09:45'])
    expect((await book(start)).body.code).toBe('APPOINTMENT_SLOT_TAKEN');
  expect((await book('09:00')).status).toBe(201);
  expect((await book('10:00')).status).toBe(201);
  expect(
    (await book('09:30', customers[1].cookie, { staffId: await staff() }))
      .status,
  ).toBe(201);
});
test('snapshot giữ nguyên khi đổi danh mục; database chặn ghi đè và bảo toàn tham chiếu', async () => {
  const { id } = (await book()).body;
  const updated = await http(
    'PATCH',
    '/admin/services/' + service.id,
    { name: 'Giá mới', priceVnd: 200000, durationMinutes: 45 },
    admin.cookie,
  );
  expect(updated.status).toBe(200);
  const a = await db.appointment.findUniqueOrThrow({ where: { id } });
  expect(a).toMatchObject({
    priceVnd: 100000,
    durationMinutes: 30,
    serviceName: 'Cắt thử',
  });
  // Bỏ qua HTTP để chứng minh chính PostgreSQL bảo vệ một đường ghi độc lập.
  await expect(
    db.appointment.create({ data: { ...a, id: randomUUID() } }),
  ).rejects.toThrow();
  const second = await book('09:30');
  expect(second.body).toMatchObject({
    priceVnd: 200000,
    durationMinutes: 45,
    serviceName: 'Giá mới',
  });
  await expect(db.appointment.delete({ where: { id } })).rejects.toThrow();
});
test('availability loại cả hai trạng thái giữ chỗ, fixture CANCELLED trả lại giờ', async () => {
  const id = (await book()).body.id;
  async function fixture(status) {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('bookinghub.actor_id',${admin.id},true)`;
      await tx.appointment.update({ where: { id }, data: { status } });
    });
  }
  const hours = async () =>
    (await preview()).body.slots.map((s) => s.startAt.slice(11, 16));
  for (const status of ['PENDING', 'CONFIRMED']) {
    if (status === 'CONFIRMED') await fixture(status);
    const h = await hours();
    expect(h).not.toContain('09:00');
    expect(h).not.toContain('09:15');
    expect(h).toContain('09:30');
    expect((await book()).body.code).toBe('APPOINTMENT_SLOT_TAKEN');
  }
  await fixture('CANCELLED');
  expect(await hours()).toContain('09:00');
  expect((await book()).status).toBe(201);
  const event = await db.appointmentEvent.findFirstOrThrow({
    where: { appointmentId: id, status: 'CANCELLED' },
  });
  expect(event).toMatchObject({
    actorId: admin.id,
    previousStatus: 'CONFIRMED',
  });
});
test('lỗi ghi lịch sử rollback cả lịch, không ánh xạ nhầm thành hết chỗ', async () => {
  // Constraint chỉ tồn tại trong DB test riêng để buộc lỗi sau khi INSERT lịch đã bắt đầu.
  await db.$executeRaw`ALTER TABLE "AppointmentEvent" ADD CONSTRAINT fixture_event_failure CHECK (false) NOT VALID`;
  try {
    const result = await book();
    expect(result.status).toBe(500);
    expect(result.body.code).toBeUndefined();
    expect(await db.appointment.count({ where: { staffId } })).toBe(0);
    expect(
      await db.appointmentEvent.count({ where: { appointment: { staffId } } }),
    ).toBe(0);
  } finally {
    await db.$executeRaw`ALTER TABLE "AppointmentEvent" DROP CONSTRAINT fixture_event_failure`;
  }
  expect((await book()).status).toBe(201);
});
test('kiểm tra lại quyền, dữ liệu do server quản lý, ca nghỉ, ngày và lưới giờ', async () => {
  expect((await book('09:00', '')).status).toBe(401);
  expect((await book('09:00', admin.cookie)).status).toBe(403);
  for (const field of [
    { customerId: admin.id },
    { priceVnd: 1 },
    { endAt: payload().startAt },
    { durationMinutes: 1 },
    { status: 'CONFIRMED' },
    { serviceName: 'X' },
  ])
    expect((await book('09:00', customers[0].cookie, field)).status).toBe(400);
  for (const time of ['09:01', '08:45', '10:45', '11:45'])
    expect((await book(time)).status).toBe(400);
  for (const startAt of [
    day.toString() + 'T09:00:00',
    day.toString() + 'T09:00:00.001+07:00',
    Temporal.Now.instant().subtract({ hours: 24 }).toString(),
    day.add({ days: 29 }).toString() + 'T09:00:00+07:00',
  ])
    expect((await book('09:00', customers[0].cookie, { startAt })).status).toBe(
      400,
    );
  await db.user.update({ where: { id: staffId }, data: { active: false } });
  expect((await book()).status).toBe(404);
  await db.user.update({ where: { id: staffId }, data: { active: true } });
  await db.service.update({
    where: { id: service.id },
    data: { active: false },
  });
  expect((await book()).status).toBe(404);
  await db.service.update({
    where: { id: service.id },
    data: { active: true },
  });
  await db.staffService.deleteMany({ where: { staffId } });
  expect((await book()).status).toBe(404);
});
test('sửa ca hoặc ngày nghỉ và đặt lịch tuần tự hóa cùng nhân viên', async () => {
  const path = '/admin/staff/' + staffId + '/schedule';
  const [created, off] = await Promise.all([
    book(),
    http('PUT', path + '/days-off/' + day.toString(), undefined, admin.cookie),
  ]);
  expect([
    [201, 409],
    [400, 204],
  ]).toContainEqual([created.status, off.status]);
  if (off.status === 204) {
    await http(
      'DELETE',
      path + '/days-off/' + day.toString(),
      undefined,
      admin.cookie,
    );
    expect((await book()).status).toBe(201);
  } else expect(off.body.appointmentIds).toContain(created.body.id);
  const change = await http(
    'PUT',
    path + '/week/' + day.dayOfWeek,
    { shifts: [] },
    admin.cookie,
  );
  expect(change.status).toBe(409);
  expect(change.body.code).toBe('SCHEDULE_AFFECTS_APPOINTMENTS');
  expect((await preview()).body.slots.length).toBeGreaterThan(0);
});
