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
  salonClock,
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
import type { Prisma } from '../generated/prisma/client';

const heldFields = {
  id: true,
  startAt: true,
  endAt: true,
  status: true,
} as const;

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
    const now = salonClock.now();
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
  private async withStaffLock<T>(
    staffId: string,
    change: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    return this.db.$transaction(
      async (tx) => {
        await lockStaff(tx, staffId);
        return change(tx);
      },
      { isolationLevel: 'ReadCommitted' },
    );
  }

  private weekProposal(weekdayText: string, body: DayScheduleDto) {
    if (!/^[1-7]$/.test(weekdayText)) throw new BadRequestException();
    return {
      weekday: Number(weekdayText),
      shifts: validatedShifts(body.shifts),
    };
  }

  private async weekImpact(
    tx: Prisma.TransactionClient,
    staffId: string,
    weekday: number,
    shifts: ReturnType<typeof validatedShifts>,
  ) {
    const held = await tx.appointment.findMany({
      where: {
        staffId,
        status: { in: holding },
        endAt: { gt: new Date(salonClock.now().epochMilliseconds) },
      },
      select: { ...heldFields, durationMinutes: true },
      orderBy: { startAt: 'asc' },
    });
    // Thời lượng trên lịch là bản chụp khi đặt, kể cả khi dịch vụ đã đổi.
    return held
      .filter((a) => {
        const local = Temporal.Instant.fromEpochMilliseconds(
          a.startAt.getTime(),
        ).toZonedDateTimeISO(salonZone);
        const start = local.hour * 60 + local.minute;
        return (
          local.dayOfWeek === weekday &&
          !shifts.some((s) => fitsShift(s, start, start + a.durationMinutes))
        );
      })
      .map(({ id, startAt, endAt, status }) => ({
        id,
        startAt,
        endAt,
        status,
      }));
  }

  async previewDay(staffId: string, weekdayText: string, body: DayScheduleDto) {
    const { weekday, shifts } = this.weekProposal(weekdayText, body);
    return this.withStaffLock(staffId, async (tx) => ({
      affectedAppointments: await this.weekImpact(tx, staffId, weekday, shifts),
    }));
  }

  async replaceDay(staffId: string, weekdayText: string, body: DayScheduleDto) {
    const { weekday, shifts } = this.weekProposal(weekdayText, body);
    await this.withStaffLock(staffId, async (tx) => {
      const affected = await this.weekImpact(tx, staffId, weekday, shifts);
      if (affected.length)
        throw new BookingConflict('SCHEDULE_AFFECTS_APPOINTMENTS', affected);
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
  private async checkDayOff(
    tx: Prisma.TransactionClient,
    staffId: string,
    day: Temporal.PlainDate,
  ) {
    const bounds = dayBounds(day);
    const held = await tx.appointment.findMany({
      where: {
        staffId,
        status: { in: holding },
        startAt: { lt: bounds.end },
        endAt: {
          gt: new Date(
            Math.max(
              salonClock.now().epochMilliseconds,
              bounds.start.getTime(),
            ),
          ),
        },
      },
      select: heldFields,
      orderBy: { startAt: 'asc' },
    });
    if (held.length)
      throw new BookingConflict('SCHEDULE_AFFECTS_APPOINTMENTS', held);
  }

  async setDayOff(staffId: string, dateText: string, off: boolean) {
    const day = salonDate(dateText);
    const date = dateColumn(day);
    await this.withStaffLock(staffId, async (tx) => {
      if (off) {
        await this.checkDayOff(tx, staffId, day);
        await tx.dayOff.upsert({
          where: { staffId_date: { staffId, date } },
          create: { staffId, date },
          update: {},
        });
      } else await tx.dayOff.deleteMany({ where: { staffId, date } });
    });
  }

  async moveDayOff(staffId: string, from: string, to: string) {
    const where = {
      staffId_date: { staffId, date: dateColumn(salonDate(from)) },
    };
    const day = salonDate(to);
    const date = dateColumn(day);
    await this.withStaffLock(staffId, async (tx) => {
      if (!(await tx.dayOff.findUnique({ where })))
        throw new NotFoundException();
      if (from === to) return;
      if (
        await tx.dayOff.findUnique({
          where: { staffId_date: { staffId, date } },
        })
      )
        throw new BookingConflict('DAY_OFF_ALREADY_EXISTS');
      await this.checkDayOff(tx, staffId, day);
      await tx.dayOff.update({ where, data: { date } });
    });
  }
}
