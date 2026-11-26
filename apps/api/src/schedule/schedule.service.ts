import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Temporal } from '@js-temporal/polyfill';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityQuery, DayScheduleDto } from './schedule.dto';
import {
  fitsShift,
  bookingDay,
  clockText,
  MinuteRange,
  salonDate,
  salonZone,
  validatedShifts,
} from './salon-time';

import {
  configuredSlots,
  dateColumn,
  dayBounds,
  holding,
  shiftFields,
} from './day-slots';
import { BookingConflict } from '../appointments/booking-conflict';
import { lockStaff } from '../prisma/staff-lock';
function asHours(range: MinuteRange) {
  return {
    start: clockText(range.startMinute),
    end: clockText(range.endMinute),
  };
}
@Injectable()
export class ScheduleService {
  constructor(private readonly db: PrismaService) {}
  async availability(query: AvailabilityQuery) {
    const now = Temporal.Now.instant();
    const day = bookingDay(query.date, now);
    const { serviceId, staffId } = query;
    const slots = await this.db.$transaction(
      async (tx) => {
        const { slots } = await configuredSlots(
          tx,
          staffId,
          serviceId,
          day,
          now,
        );
        const { start, end } = dayBounds(day);
        const held = await tx.appointment.findMany({
          where: {
            staffId,
            status: { in: holding },
            startAt: { lt: end },
            endAt: { gt: start },
          },
          select: { startAt: true, endAt: true },
        });
        return slots.filter(
          (slot) =>
            !held.some(
              (h) =>
                Date.parse(slot.startAt) < h.endAt.getTime() &&
                h.startAt.getTime() < Date.parse(slot.endAt),
            ),
        );
      },
      { isolationLevel: 'RepeatableRead' },
    );
    return { serviceId, staffId, date: query.date, timeZone: salonZone, slots };
  }
  async schedule(staffId: string) {
    const staff = await this.db.staffProfile.findUnique({
      where: { userId: staffId },
      select: {
        workDays: {
          orderBy: { weekday: 'asc' },
          select: { weekday: true, shifts: shiftFields },
        },
        daysOff: { orderBy: { date: 'asc' }, select: { date: true } },
      },
    });
    if (!staff) throw new NotFoundException();
    return {
      week: staff.workDays.map((d) => ({
        weekday: d.weekday,
        shifts: d.shifts.map((s) => ({
          ...asHours(s),
          breaks: s.breaks.map(asHours),
        })),
      })),
      daysOff: staff.daysOff.map((o) => o.date.toISOString().slice(0, 10)),
    };
  }
  async replaceDay(staffId: string, weekdayText: string, body: DayScheduleDto) {
    if (!/^[1-7]$/.test(weekdayText)) throw new BadRequestException();
    const weekday = Number(weekdayText);
    const shifts = validatedShifts(body.shifts);
    await this.db.$transaction(async (tx) => {
      await lockStaff(tx, staffId);
      const held = await tx.appointment.findMany({
        where: { staffId, status: { in: holding }, endAt: { gt: new Date() } },
        select: { id: true, startAt: true, durationMinutes: true },
      });
      const affected = held.filter((a) => {
        const local = Temporal.Instant.fromEpochMilliseconds(
          a.startAt.getTime(),
        ).toZonedDateTimeISO(salonZone);
        const start = local.hour * 60 + local.minute;
        return (
          local.dayOfWeek === weekday &&
          !shifts.some((s) => fitsShift(s, start, start + a.durationMinutes))
        );
      });
      if (affected.length)
        throw new BookingConflict(
          'SCHEDULE_AFFECTS_APPOINTMENTS',
          affected.map((a) => a.id),
        );
      await tx.workDay.upsert({
        where: { staffId_weekday: { staffId, weekday } },
        create: { staffId, weekday },
        update: {},
      });
      await tx.workShift.deleteMany({ where: { staffId, weekday } });
      if (!shifts.length) return;
      const rows = shifts.map(({ startMinute, endMinute }) => ({
        id: randomUUID(),
        staffId,
        weekday,
        startMinute,
        endMinute,
      }));
      const breaks = shifts.flatMap((shift, i) =>
        shift.breaks.map((b) => ({ ...b, shiftId: rows[i].id })),
      );
      await tx.workShift.createMany({ data: rows });
      if (breaks.length) await tx.shiftBreak.createMany({ data: breaks });
    });
  }
  async setDayOff(staffId: string, dateText: string, off: boolean) {
    const date = dateColumn(salonDate(dateText));
    await this.db.$transaction(async (tx) => {
      await lockStaff(tx, staffId);
      if (off) {
        const bounds = dayBounds(salonDate(dateText));
        const held = await tx.appointment.findMany({
          where: {
            staffId,
            status: { in: holding },
            startAt: { lt: bounds.end },
            endAt: {
              gt: new Date(Math.max(Date.now(), bounds.start.getTime())),
            },
          },
          select: { id: true },
        });
        if (held.length)
          throw new BookingConflict(
            'SCHEDULE_AFFECTS_APPOINTMENTS',
            held.map((a) => a.id),
          );
        await tx.dayOff.upsert({
          where: { staffId_date: { staffId, date } },
          create: { staffId, date },
          update: {},
        });
      } else await tx.dayOff.deleteMany({ where: { staffId, date } });
    });
  }
}
