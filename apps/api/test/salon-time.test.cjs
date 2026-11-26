const { test, expect } = require('@jest/globals');
const { Temporal } = require('@js-temporal/polyfill');
const {
  availableSlots,
  bookingDay,
  validatedShifts,
} = require('../dist/schedule/salon-time');

test('ngày mới của salon bắt đầu lúc 17:00 UTC và cửa sổ gồm đủ 30 ngày', () => {
  const now = Temporal.Instant.from('2027-01-01T17:00:00Z');
  expect(bookingDay('2027-01-02', now).toString()).toBe('2027-01-02');
  expect(bookingDay('2027-01-31', now).toString()).toBe('2027-01-31');
  expect(() => bookingDay('2027-01-01', now)).toThrow();
  expect(() => bookingDay('2027-02-01', now)).toThrow();
});
test('giờ trống tôn trọng bước 15 phút và biên nửa mở của khoảng nghỉ', () => {
  const now = Temporal.Instant.from('2027-01-02T09:00:00+07:00');
  const day = bookingDay('2027-01-02', now);
  const shifts = validatedShifts([
    {
      start: '09:07',
      end: '10:30',
      breaks: [{ start: '09:45', end: '10:00' }],
    },
  ]);
  expect(
    availableSlots(day, 30, shifts, now).map((s) => s.startAt.slice(11, 16)),
  ).toEqual(['09:15', '10:00']);
});
test('không nhận ca chồng nhau hoặc khoảng nghỉ nằm ngoài ca', () => {
  expect(() =>
    validatedShifts([
      { start: '09:00', end: '10:00', breaks: [] },
      { start: '09:59', end: '11:00', breaks: [] },
    ]),
  ).toThrow();
  expect(() =>
    validatedShifts([
      {
        start: '09:00',
        end: '10:00',
        breaks: [{ start: '08:59', end: '09:30' }],
      },
    ]),
  ).toThrow();
});
