import { NotFoundException } from '@nestjs/common';
import { Temporal } from '@js-temporal/polyfill';
import { Prisma, AppointmentStatus } from '../generated/prisma/client';
import { availableSlots, salonZone } from './salon-time';

export const holding: AppointmentStatus[] = ['PENDING', 'CONFIRMED'];
export const shiftFields = {
  orderBy: { startMinute: 'asc' },
  select: {
    startMinute: true,
    endMinute: true,
    breaks: {
      orderBy: { startMinute: 'asc' },
      select: { startMinute: true, endMinute: true },
    },
  },
} as const;
export function dateColumn(day: Temporal.PlainDate) {
  // Prisma dùng đối tượng Date tại 00:00 UTC để mã hóa cột DATE của salon.
  return new Date(day.toString() + 'T00:00:00.000Z');
}
export function dayBounds(day: Temporal.PlainDate) {
  const midnight = day.toZonedDateTime(salonZone);
  return {
    start: new Date(midnight.epochMilliseconds),
    end: new Date(midnight.add({ days: 1 }).epochMilliseconds),
  };
}
export async function configuredSlots(
  tx: Prisma.TransactionClient,
  staffId: string,
  serviceId: string,
  day: Temporal.PlainDate,
  now: Temporal.Instant,
) {
  const assignment = await tx.staffService.findFirst({
    where: {
      staffId,
      serviceId,
      staff: { user: { active: true } },
      service: { active: true },
    },
    select: {
      service: {
        select: { name: true, priceVnd: true, durationMinutes: true },
      },
    },
  });
  if (!assignment) throw new NotFoundException();
  const { service } = assignment;
  const off = await tx.dayOff.findUnique({
    where: { staffId_date: { staffId, date: dateColumn(day) } },
  });
  if (off) return { service, slots: [] };
  const shifts = await tx.workShift.findMany({
    where: { staffId, weekday: day.dayOfWeek },
    ...shiftFields,
  });
  return {
    service,
    slots: availableSlots(day, service.durationMinutes, shifts, now),
  };
}
