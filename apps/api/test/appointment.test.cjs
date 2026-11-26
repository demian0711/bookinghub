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
const { salonClock } = require('../dist/schedule/salon-time');
const realNow = salonClock.now;
let instant, password;
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
  password = randomUUID();
  passwordHash = await hashPassword(password);
  customers = [
    await user('CUSTOMER', password),
    await user('CUSTOMER', password),
  ];
  admin = await user('ADMIN', password);
});
beforeEach(async () => {
  instant = Temporal.Instant.from('2032-06-01T08:00:00+07:00');
  salonClock.now = () => instant;
  day = instant.toZonedDateTimeISO(zone).toPlainDate().add({ days: 1 });
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
  salonClock.now = realNow;
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
    instant.subtract({ hours: 24 }).toString(),
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

function scheduleRequest(method, path, body) {
  return http(
    method,
    '/admin/staff/' + staffId + '/schedule/' + path,
    body,
    admin.cookie,
  );
}
const week = () => 'week/' + day.dayOfWeek;
const shift = (start, end, breaks = []) => ({
  shifts: [{ start, end, breaks }],
});

test('preview trước khi đặt không cấp quyền ghi đè; cả hai trạng thái giữ chỗ đều được bảo vệ', async () => {
  const closed = { shifts: [] };
  const inspect = () => scheduleRequest('POST', week() + '/preview', closed);
  expect(await inspect()).toMatchObject({
    status: 200,
    body: { affectedAppointments: [] },
  });
  const first = (await book()).body;
  const second = (await book('09:30')).body;
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('bookinghub.actor_id',${admin.id},true)`;
    await tx.appointment.update({
      where: { id: second.id },
      data: { status: 'CONFIRMED' },
    });
  });
  const expected = [
    {
      id: first.id,
      status: 'PENDING',
      startAt: first.startAt,
      endAt: first.endAt,
    },
    {
      id: second.id,
      status: 'CONFIRMED',
      startAt: second.startAt,
      endAt: second.endAt,
    },
  ];
  expect((await inspect()).body.affectedAppointments).toEqual(expected);
  const saved = await scheduleRequest('PUT', week(), closed);
  expect(saved).toMatchObject({
    status: 409,
    body: {
      code: 'SCHEDULE_AFFECTS_APPOINTMENTS',
      affectedAppointments: expected,
    },
  });
  expect(
    (await scheduleRequest('PUT', week(), shift('09:00', '10:00'))).status,
  ).toBe(204);
  for (const proposal of [
    shift('09:00', '09:45'),
    shift('09:00', '10:00', [{ start: '09:45', end: '10:00' }]),
  ]) {
    const rejected = await scheduleRequest('PUT', week(), proposal);
    expect(rejected).toMatchObject({
      status: 409,
      body: { appointmentIds: [second.id] },
    });
  }
  expect(
    await db.workShift.findMany({
      where: { staffId },
      select: { startMinute: true, endMinute: true, breaks: true },
    }),
  ).toEqual([{ startMinute: 540, endMinute: 600, breaks: [] }]);
});

test('đổi ngày nghỉ nguyên tử, bảo toàn ngày nguồn khi đích có lịch hoặc đã nghỉ', async () => {
  const from = day.add({ days: 1 }).toString();
  const to = day.add({ days: 2 }).toString();
  const days = (method, date, body) =>
    scheduleRequest(method, 'days-off/' + date, body);
  const created = (await book()).body;
  expect((await days('PUT', from)).status).toBe(204);
  expect(await days('PATCH', from, { date: day.toString() })).toMatchObject({
    status: 409,
    body: { appointmentIds: [created.id] },
  });
  expect((await days('PUT', to)).status).toBe(204);
  expect(await days('PATCH', from, { date: to })).toMatchObject({
    status: 409,
    body: { code: 'DAY_OFF_ALREADY_EXISTS' },
  });
  expect((await days('DELETE', to)).status).toBe(204);
  expect((await days('PATCH', from, { date: to })).status).toBe(204);
  expect((await days('PATCH', from, { date: from })).status).toBe(404);
  expect(
    (await db.dayOff.findMany({ where: { staffId } })).map((d) =>
      d.date.toISOString().slice(0, 10),
    ),
  ).toEqual([to]);
  expect((await days('DELETE', to)).status).toBe(204);
  expect(await db.dayOff.count({ where: { staffId } })).toBe(0);
  expect(
    await db.appointment.findUniqueOrThrow({ where: { id: created.id } }),
  ).toMatchObject({ status: 'PENDING' });
});

test.each(['ca', 'ngày nghỉ'])(
  'đặt đồng thời với đổi %s: kiểm tra cấu hình và lịch cuối trong PostgreSQL',
  async (kind) => {
    const isShift = kind === 'ca';
    const [booking, edit] = await Promise.all([
      book(),
      isShift
        ? scheduleRequest('PUT', week(), shift('10:00', '12:00'))
        : scheduleRequest('PUT', 'days-off/' + day.toString()),
    ]);
    expect([
      [201, 409],
      [400, 204],
    ]).toContainEqual([booking.status, edit.status]);
    const shifts = await db.workShift.findMany({
      where: { staffId, weekday: day.dayOfWeek },
    });
    const daysOff = await db.dayOff.count({ where: { staffId } });
    const held = await db.appointment.findMany({
      where: { staffId, status: { in: ['PENDING', 'CONFIRMED'] } },
    });
    expect(shifts.map((s) => s.startMinute)).toEqual([
      isShift && edit.status === 204 ? 600 : 540,
    ]);
    expect(daysOff).toBe(!isShift && edit.status === 204 ? 1 : 0);
    expect(held.map((a) => a.id)).toEqual(
      booking.status === 201 ? [booking.body.id] : [],
    );
    if (booking.status === 201)
      expect(edit.body.appointmentIds).toEqual([booking.body.id]);
  },
);

test('bỏ phân công, ngừng hoạt động và tăng thời lượng chỉ đổi điều kiện đặt mới', async () => {
  const id = (await book()).body.id;
  const saved = await db.appointment.findUniqueOrThrow({ where: { id } });
  const staffPath = '/admin/staff/' + staffId;
  const servicePath = '/admin/services/' + service.id;
  for (const [method, path, disable, enable] of [
    [
      'PUT',
      staffPath + '/services',
      { serviceIds: [] },
      { serviceIds: [service.id] },
    ],
    ['PATCH', staffPath, { active: false }, { active: true }],
    ['PATCH', servicePath, { active: false }, { active: true }],
  ]) {
    expect(
      (await http(method, path, disable, admin.cookie)).status,
    ).toBeLessThan(300);
    expect((await book('09:30')).status).toBe(404);
    expect((await scheduleRequest('PUT', week(), { shifts: [] })).status).toBe(
      409,
    );
    expect(
      (await http(method, path, enable, admin.cookie)).status,
    ).toBeLessThan(300);
  }
  expect(
    (await http('PATCH', servicePath, { durationMinutes: 60 }, admin.cookie))
      .status,
  ).toBe(200);
  expect(
    (await scheduleRequest('PUT', week(), shift('09:00', '10:00'))).status,
  ).toBe(204);
  expect((await book('09:30')).status).toBe(400);
  expect(await db.appointment.findUniqueOrThrow({ where: { id } })).toEqual(
    saved,
  );
});

const changeStatus = (id, expectedStatus, status, cookie, extra = {}) =>
  http(
    'PATCH',
    '/appointments/' + id + '/status',
    { expectedStatus, status, ...extra },
    cookie,
  );
const detail = (id, cookie) =>
  http('GET', '/appointments/' + id, undefined, cookie);
async function staffCookie(id) {
  const { email } = await db.user.findUniqueOrThrow({ where: { id } });
  const res = await http('POST', '/auth/login', { email, password });
  expect(res.status).toBe(200);
  return res.cookie;
}
test('phạm vi đọc, bộ lọc, phân trang và quyền xử lý lấy từ phiên', async () => {
  const mine = (await book()).body;
  const otherStaff = await staff();
  const theirs = (
    await book('09:30', customers[1].cookie, { staffId: otherStaff })
  ).body;
  const cookie = await staffCookie(staffId);
  for (const viewer of [customers[0].cookie, cookie]) {
    const missing = await detail(randomUUID(), viewer);
    expect(missing.status).toBe(404);
    expect((await detail(theirs.id, viewer)).body).toEqual(missing.body);
    expect(
      (
        await changeStatus(theirs.id, 'PENDING', 'CANCELLED', viewer, {
          reason: 'Bận',
        })
      ).body,
    ).toEqual(missing.body);
    expect((await detail(mine.id, viewer)).status).toBe(200);
    expect(
      (
        await http(
          'GET',
          '/appointments?staffId=' + otherStaff,
          undefined,
          viewer,
        )
      ).body.total,
    ).toBe(0);
  }
  const query =
    '/appointments?date=' +
    day.toString() +
    '&status=PENDING&staffId=' +
    staffId +
    '&sort=startAt&order=desc&pageSize=1';
  expect(
    (await http('GET', query, undefined, admin.cookie)).body,
  ).toMatchObject({ items: [{ id: mine.id }], page: 1, pageSize: 1, total: 1 });
  expect(
    (await http('GET', query + '&page=2', undefined, cookie)).body.items,
  ).toEqual([]);
  expect((await detail(theirs.id, admin.cookie)).status).toBe(200);
  for (const q of [
    'sort=actorId',
    'pageSize=51',
    'page=1001',
    'date=2032-02-30',
    'customerId=' + customers[0].id,
  ])
    expect(
      (await http('GET', '/appointments?' + q, undefined, cookie)).status,
    ).toBe(400);
  expect(
    (await changeStatus(mine.id, 'PENDING', 'CONFIRMED', customers[0].cookie))
      .status,
  ).toBe(403);
  for (const extra of [
    { actorId: admin.id },
    { customerId: customers[1].id },
    { history: [] },
  ]) {
    expect(
      (await changeStatus(mine.id, 'PENDING', 'CONFIRMED', cookie, extra))
        .status,
    ).toBe(400);
  }
  expect(
    (await changeStatus(mine.id, 'PENDING', 'CONFIRMED', cookie)).status,
  ).toBe(200);
  for (const viewer of [admin.cookie, cookie])
    expect(
      (
        await changeStatus(mine.id, 'CONFIRMED', 'CANCELLED', viewer, {
          reason: '  ',
        })
      ).status,
    ).toBe(400);
  const cancelled = await changeStatus(
    mine.id,
    'CONFIRMED',
    'CANCELLED',
    cookie,
    { reason: '  Đổi ca  ' },
  );
  expect(cancelled.status).toBe(200);
  expect(cancelled.body.events.at(-1)).toMatchObject({
    actorId: staffId,
    reason: 'Đổi ca',
    previousStatus: 'CONFIRMED',
    status: 'CANCELLED',
  });
});
test.each([
  [-1, 200],
  [0, 200],
  [1, 409],
])('khách hủy cách hạn hai giờ %i ms', async (delta, expected) => {
  const a = (await book()).body;
  instant = Temporal.Instant.from(a.startAt)
    .subtract({ hours: 2 })
    .add({ milliseconds: delta });
  const result = await changeStatus(
    a.id,
    'PENDING',
    'CANCELLED',
    customers[0].cookie,
  );
  expect(result.status).toBe(expected);
  const slots = (await preview()).body.slots;
  expect(
    slots.some((s) => Date.parse(s.startAt) === Date.parse(a.startAt)),
  ).toBe(expected === 200);
  if (expected === 200)
    expect(
      (await changeStatus(a.id, 'PENDING', 'CONFIRMED', admin.cookie)).status,
    ).toBe(409);
});
test.each([
  ['COMPLETED', 'endAt'],
  ['NO_SHOW', 'startAt'],
])('%s chỉ từ CONFIRMED và đúng mốc thời gian', async (status, key) => {
  const a = (await book()).body;
  instant = Temporal.Instant.from(a[key]).subtract({ milliseconds: 1 });
  expect(
    (await changeStatus(a.id, 'PENDING', status, admin.cookie)).status,
  ).toBe(409);
  expect(
    (await changeStatus(a.id, 'PENDING', 'CONFIRMED', admin.cookie)).status,
  ).toBe(200);
  expect(
    (await changeStatus(a.id, 'CONFIRMED', status, admin.cookie)).status,
  ).toBe(409);
  instant = Temporal.Instant.from(a[key]);
  expect(
    (await changeStatus(a.id, 'CONFIRMED', status, admin.cookie)).status,
  ).toBe(200);
  expect(
    (
      await changeStatus(a.id, 'CONFIRMED', 'CANCELLED', admin.cookie, {
        reason: 'Đổi ca',
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await changeStatus(a.id, status, 'CANCELLED', admin.cookie, {
        reason: 'Thử lại',
      })
    ).status,
  ).toBe(409);
  const saved = await detail(a.id, admin.cookie);
  expect(saved.body.events.map((e) => e.status)).toEqual([
    'PENDING',
    'CONFIRMED',
    status,
  ]);
});
test('hai thao tác từ cùng trạng thái nguồn chỉ ghi một sự kiện mới', async () => {
  const a = (await book()).body;
  const results = await Promise.all([
    changeStatus(a.id, 'PENDING', 'CONFIRMED', admin.cookie),
    changeStatus(a.id, 'PENDING', 'CANCELLED', customers[0].cookie),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(results.find((r) => r.status === 409).body.code).toBe(
    'APPOINTMENT_STATE_CONFLICT',
  );
  const saved = (await detail(a.id, admin.cookie)).body;
  expect(saved.status).toBe(results.find((r) => r.status === 200).body.status);
  expect(saved.events.map((e) => e.status)).toEqual(['PENDING', saved.status]);
});
test('lỗi ghi lịch sử chuyển trạng thái rollback cả thay đổi', async () => {
  const a = (await book()).body;
  await db.$executeRaw`ALTER TABLE "AppointmentEvent" ADD CONSTRAINT fixture_transition_failure CHECK ("previousStatus" IS NULL) NOT VALID`;
  try {
    expect(
      (await changeStatus(a.id, 'PENDING', 'CONFIRMED', admin.cookie)).status,
    ).toBe(500);
    const saved = (await detail(a.id, admin.cookie)).body;
    expect(saved.status).toBe('PENDING');
    expect(saved.events.map((e) => e.status)).toEqual(['PENDING']);
  } finally {
    await db.$executeRaw`ALTER TABLE "AppointmentEvent" DROP CONSTRAINT fixture_transition_failure`;
  }
});
