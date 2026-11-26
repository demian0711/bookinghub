import { BadRequestException } from '@nestjs/common';
import { Temporal } from '@js-temporal/polyfill';

export const salonZone = 'Asia/Ho_Chi_Minh';
export interface MinuteRange {
  startMinute: number;
  endMinute: number;
}
export interface ShiftRange extends MinuteRange {
  breaks: MinuteRange[];
}

export function salonDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000'))
    throw new BadRequestException();
  try {
    return Temporal.PlainDate.from(value, { overflow: 'reject' });
  } catch {
    throw new BadRequestException();
  }
}
export function bookingDay(value: string, now: Temporal.Instant) {
  const day = salonDate(value);
  const today = now.toZonedDateTimeISO(salonZone).toPlainDate();
  if (
    Temporal.PlainDate.compare(day, today) < 0 ||
    Temporal.PlainDate.compare(day, today.add({ days: 29 })) > 0
  )
    throw new BadRequestException();
  return day;
}
export function minutes(value: string, end = false) {
  if (end && value === '24:00') return 1440;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new BadRequestException();
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}
export function clockText(value: number) {
  return [Math.floor(value / 60), value % 60]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}
function range(input: { start: string; end: string }): MinuteRange {
  const startMinute = minutes(input.start),
    endMinute = minutes(input.end, true);
  if (startMinute >= endMinute) throw new BadRequestException();
  return { startMinute, endMinute };
}
function ordered<T extends MinuteRange>(ranges: T[]): T[] {
  ranges.sort((a, b) => a.startMinute - b.startMinute);
  if (ranges.some((r, i) => i > 0 && ranges[i - 1].endMinute > r.startMinute))
    throw new BadRequestException();
  return ranges;
}
export function validatedShifts(
  input: {
    start: string;
    end: string;
    breaks: { start: string; end: string }[];
  }[],
): ShiftRange[] {
  return ordered(
    input.map((item) => {
      const shift = range(item);
      const breaks = ordered(item.breaks.map(range));
      if (
        breaks.some(
          (b) =>
            b.startMinute < shift.startMinute || b.endMinute > shift.endMinute,
        )
      )
        throw new BadRequestException();
      return { ...shift, breaks };
    }),
  );
}

export function availableSlots(
  day: Temporal.PlainDate,
  duration: number,
  shifts: ShiftRange[],
  now: Temporal.Instant,
) {
  const midnight = day.toZonedDateTime(salonZone);
  const slots: { startAt: string; endAt: string }[] = [];
  for (const shift of shifts) {
    // Căn theo đồng hồ salon ngay cả khi ca bắt đầu lúc lẻ, ví dụ 09:07 → 09:15.
    for (
      let start = Math.ceil(shift.startMinute / 15) * 15;
      start + duration <= shift.endMinute;
      start += 15
    ) {
      const end = start + duration;
      if (shift.breaks.some((b) => start < b.endMinute && b.startMinute < end))
        continue;
      const startAt = midnight.add({ minutes: start });
      if (Temporal.Instant.compare(startAt.toInstant(), now) < 0) continue;
      const format = { timeZoneName: 'never', smallestUnit: 'second' } as const;
      slots.push({
        startAt: startAt.toString(format),
        endAt: midnight.add({ minutes: end }).toString(format),
      });
    }
  }
  return slots;
}
