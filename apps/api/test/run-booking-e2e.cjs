const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { randomUUID } = require('node:crypto');
const { Temporal } = require('@js-temporal/polyfill');
const { hashPassword } = require('../dist/auth/password');
async function runBookingTests({ db, origin, webDir, webRequire }) {
  // Ngày test luôn nằm trong cửa sổ của salon và đủ xa để khách được hủy.
  const day = Temporal.Now.plainDateISO('Asia/Ho_Chi_Minh').add({ days: 2 });
  const password = randomUUID(),
    passwordHash = await hashPassword(password);
  const service = await db.service.create({
    data: {
      name: 'Chăm sóc tóc E2E',
      description: 'Dịch vụ kiểm thử',
      durationMinutes: 30,
      priceVnd: 180000,
    },
  });
  for (const displayName of ['An', 'Bình']) {
    await db.staffProfile.create({
      data: {
        user: {
          create: {
            displayName,
            role: 'STAFF',
            email: randomUUID() + '@example.test',
            passwordHash,
          },
        },
        assignments: { create: { serviceId: service.id } },
        workDays: {
          create: {
            weekday: day.dayOfWeek,
            shifts: { create: { startMinute: 540, endMinute: 720 } },
          },
        },
      },
    });
  }
  for (const name of ['mai', 'lan', 'hoa'])
    await db.user.create({
      data: {
        displayName: name,
        email: name + '@example.test',
        passwordHash,
        role: 'CUSTOMER',
      },
    });
  const customer = await db.user.create({
    data: {
      displayName: 'Vy',
      email: 'vy@example.test',
      role: 'CUSTOMER',
      passwordHash,
    },
  });
  const staff = await db.staffProfile.findFirstOrThrow();
  // Sáu lịch cũ để kiểm tra trang thứ hai, bản chụp và từ chối hủy khi quá hạn.
  for (let i = 0; i < 6; i++) {
    const start = day
      .subtract({ days: 10 + i })
      .toZonedDateTime({ timeZone: 'Asia/Ho_Chi_Minh', plainTime: '09:00' });
    await db.appointment.create({
      data: {
        customerId: customer.id,
        staffId: staff.userId,
        serviceId: service.id,
        serviceName: 'Dịch vụ lúc đặt',
        priceVnd: 120000,
        durationMinutes: 45,
        startAt: new Date(start.epochMilliseconds),
        endAt: new Date(start.add({ minutes: 45 }).epochMilliseconds),
      },
    });
  }
  const child = spawn(
    process.execPath,
    [
      webRequire.resolve('@playwright/test/cli'),
      'test',
      '--config=e2e/playwright.config.ts',
    ],
    {
      cwd: webDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        E2E_ORIGIN: origin,
        E2E_DAY: day.toString(),
        E2E_PASSWORD: password,
      },
    },
  );
  const [code] = await once(child, 'exit');
  if (code !== 0)
    throw Error('Kiểm thử đặt lịch thất bại. Xem báo cáo Playwright.');
}
module.exports = { runBookingTests };
