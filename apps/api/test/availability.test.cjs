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
const {
  availableSlots,
  bookingDay,
  salonDate,
  validatedShifts,
  salonZone,
} = require('../dist/schedule/salon-time');

let app,
  db,
  base,
  adminCookie,
  staffId,
  serviceId,
  date,
  weekday,
  adminPath,
  passwordHash;
const shift = (start, end, breaks = []) => ({ start, end, breaks });
async function http(method, path, body, cookie) {
  const result = await fetch(base + path, {
    method,
    headers: {
      Origin: 'http://localhost:3000',
      'X-BookingHub-CSRF': '1',
      'Content-Type': 'application/json',
      Cookie: cookie ?? '',
    },
    body: JSON.stringify(body),
  });
  return {
    status: result.status,
    body: result.status === 204 ? null : await result.json(),
    cookie: result.headers.get('set-cookie')?.split(';')[0],
  };
}
const replace = (shifts) =>
  http('PUT', adminPath + '/week/' + weekday, { shifts }, adminCookie);
const availability = (params = {}) =>
  http(
    'GET',
    '/availability?' +
      new URLSearchParams({ staffId, serviceId, date, ...params }),
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
  const password = randomUUID(),
    email = randomUUID() + '@example.test';
  passwordHash = await hashPassword(password);
  await db.user.create({
    data: { role: 'ADMIN', email, displayName: 'Admin', passwordHash },
  });
  const login = await http('POST', '/auth/login', { email, password });
  expect(login.status).toBe(200);
  adminCookie = login.cookie;
});
beforeEach(async () => {
  const profile = await db.staffProfile.create({
    data: {
      user: {
        create: {
          role: 'STAFF',
          email: randomUUID() + '@example.test',
          displayName: 'Staff',
          passwordHash,
        },
      },
    },
  });
  staffId = profile.userId;
  const service = await db.service.create({
    data: {
      name: 'Test',
      description: '',
      priceVnd: 100000,
      durationMinutes: 30,
      assignments: { create: { staffId } },
    },
  });
  serviceId = service.id;
  const tomorrow = Temporal.Now.plainDateISO(salonZone).add({ days: 1 });
  date = tomorrow.toString();
  weekday = tomorrow.dayOfWeek;
  adminPath = '/admin/staff/' + staffId + '/schedule';
});
afterAll(async () => {
  if (app) await app.close();
});

test('giờ thực tế theo ca: căn lưới 15 phút, nối sát giờ nghỉ và cuối ca', async () => {
  expect(
    (
      await replace([
        shift('13:00', '13:30'),
        shift('09:07', '11:00', [{ start: '09:45', end: '10:30' }]),
      ])
    ).status,
  ).toBe(204);
  const result = await availability();
  expect(result.status).toBe(200);
  expect(result.body).toEqual({
    staffId,
    serviceId,
    date,
    timeZone: salonZone,
    slots: [
      { startAt: date + 'T09:15:00+07:00', endAt: date + 'T09:45:00+07:00' },
      { startAt: date + 'T10:30:00+07:00', endAt: date + 'T11:00:00+07:00' },
      { startAt: date + 'T13:00:00+07:00', endAt: date + 'T13:30:00+07:00' },
    ],
  });
});
test('không có ca, ca quá ngắn, hai ca nối tiếp và kết thúc lúc nửa đêm', async () => {
  expect((await availability()).body.slots).toEqual([]);
  expect(
    (await replace([shift('09:00', '09:15'), shift('09:15', '09:30')])).status,
  ).toBe(204);
  expect((await availability()).body.slots).toEqual([]);
  expect((await replace([shift('23:30', '24:00')])).status).toBe(204);
  const next = salonDate(date).add({ days: 1 }).toString();
  expect((await availability()).body.slots).toEqual([
    { startAt: date + 'T23:30:00+07:00', endAt: next + 'T00:00:00+07:00' },
  ]);
});
test('ngày nghỉ riêng nhân viên, thêm/bỏ lặp được; đọc lại và xóa ca', async () => {
  expect((await replace([shift('10:00', '10:30')])).status).toBe(204);
  const path = adminPath + '/days-off/' + date;
  for (let i = 0; i < 2; i++)
    expect((await http('PUT', path, undefined, adminCookie)).status).toBe(204);
  expect((await availability()).body.slots).toEqual([]);
  expect((await http('GET', adminPath, undefined, adminCookie)).body).toEqual({
    week: [{ weekday, shifts: [shift('10:00', '10:30')] }],
    daysOff: [date],
  });
  for (let i = 0; i < 2; i++)
    expect((await http('DELETE', path, undefined, adminCookie)).status).toBe(
      204,
    );
  expect((await availability()).body.slots).toHaveLength(1);
  expect((await replace([])).status).toBe(204);
  expect((await availability()).body.slots).toEqual([]);
});
test('từ chối giờ sai, qua đêm, chồng ca và khoảng nghỉ ngoài ca hoặc chồng nhau; giữ cấu hình cũ', async () => {
  const original = [shift('10:00', '11:00')];
  await replace(original);
  const invalid = [
    [shift('9:00', '10:00')],
    [shift('09:60', '12:00')],
    [shift('24:00', '24:00')],
    [shift('09:00', '09:00')],
    [shift('23:00', '01:00')],
    [shift('10:00', '12:00'), shift('09:00', '10:01')],
    [shift('09:00', '12:00', [{ start: '08:59', end: '09:10' }])],
    [shift('09:00', '12:00', [{ start: '11:30', end: '12:01' }])],
    [shift('09:00', '12:00', [{ start: '10:30', end: '10:00' }])],
    [
      shift('09:00', '12:00', [
        { start: '09:30', end: '10:30' },
        { start: '10:00', end: '11:00' },
      ]),
    ],
  ];
  for (const shifts of invalid)
    expect((await replace(shifts)).status).toBe(400);
  for (const bad of ['0', '8', '2.5'])
    expect(
      (
        await http(
          'PUT',
          adminPath + '/week/' + bad,
          { shifts: [] },
          adminCookie,
        )
      ).status,
    ).toBe(400);
  expect(
    (await http('GET', adminPath, undefined, adminCookie)).body.week[0].shifts,
  ).toEqual(original);
});
test('chỉ ADMIN sửa; loại cặp dịch vụ và nhân viên không hợp lệ', async () => {
  expect((await http('GET', adminPath)).status).toBe(401);
  const pw = randomUUID(),
    email = randomUUID() + '@example.test';
  await db.user.create({
    data: { email, displayName: 'Khách', passwordHash: await hashPassword(pw) },
  });
  const login = await http('POST', '/auth/login', { email, password: pw });
  expect(
    (
      await http(
        'PUT',
        adminPath + '/week/' + weekday,
        { shifts: [] },
        login.cookie,
      )
    ).status,
  ).toBe(403);
  await db.service.update({
    where: { id: serviceId },
    data: { active: false },
  });
  expect((await availability()).status).toBe(404);
  await db.service.update({ where: { id: serviceId }, data: { active: true } });
  await db.user.update({ where: { id: staffId }, data: { active: false } });
  expect((await availability()).status).toBe(404);
  await db.user.update({ where: { id: staffId }, data: { active: true } });
  await db.staffService.deleteMany({ where: { staffId, serviceId } });
  expect((await availability()).status).toBe(404);
});
test('ngày sai định dạng, không tồn tại và ngoài cửa sổ', async () => {
  const today = Temporal.Now.plainDateISO(salonZone);
  for (const bad of [
    '2026-02-30',
    '2026-1-01',
    '2026-01-01T00:00:00Z',
    '0000-01-01',
  ]) {
    expect((await availability({ date: bad })).status).toBe(400);
    expect(
      (
        await http(
          'PUT',
          adminPath + '/days-off/' + bad,
          undefined,
          adminCookie,
        )
      ).status,
    ).toBe(400);
  }
  expect(
    (await availability({ date: today.subtract({ days: 1 }).toString() }))
      .status,
  ).toBe(400);
  expect((await availability({ date: today.toString() })).status).toBe(200);
  expect(
    (await availability({ date: today.add({ days: 29 }).toString() })).status,
  ).toBe(200);
  expect(
    (await availability({ date: today.add({ days: 30 }).toString() })).status,
  ).toBe(400);
  expect((await availability({ staffId: 'abc' })).status).toBe(400);
});
test('ngày salon khác ngày tiến trình, cửa sổ qua năm và mốc hiện tại chính xác tới mili giây', () => {
  expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(
    'America/Los_Angeles',
  );
  const instant = Temporal.Instant.from('2026-12-31T17:00:00Z');
  const day = bookingDay('2027-01-01', instant);
  expect(() => bookingDay('2026-12-31', instant)).toThrow();
  expect(bookingDay('2027-01-30', instant).toString()).toBe('2027-01-30');
  expect(() => bookingDay('2027-01-31', instant)).toThrow();
  const shifts = validatedShifts([shift('00:00', '00:45')]);
  expect(availableSlots(day, 30, shifts, instant)).toHaveLength(2);
  expect(
    availableSlots(day, 30, shifts, instant.add({ milliseconds: 1 })),
  ).toEqual([
    {
      startAt: '2027-01-01T00:15:00+07:00',
      endAt: '2027-01-01T00:45:00+07:00',
    },
  ]);
});
