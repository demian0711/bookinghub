import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Temporal } from '@js-temporal/polyfill';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityQuery, DayScheduleDto } from './schedule.dto';
import {
  availableSlots,
  bookingDay,
  clockText,
  MinuteRange,
  salonDate,
  salonZone,
  validatedShifts,
} from './salon-time';

const shiftFields = {
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
function asHours(range: MinuteRange) {
  return {
    start: clockText(range.startMinute),
    end: clockText(range.endMinute),
  };
}
function dateColumn(day: Temporal.PlainDate) {
  // Prisma biểu diễn SQL DATE bằng Date UTC; đây chỉ là mã hóa ngày, không phải giờ bắt đầu ca.
  return new Date(day.toString() + 'T00:00:00.000Z');
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
        const assignment = await tx.staffService.findFirst({
          where: {
            serviceId,
            staffId,
            service: { active: true },
            staff: { user: { active: true } },
          },
          select: { service: { select: { durationMinutes: true } } },
        });
        if (!assignment) throw new NotFoundException();
        const off = await tx.dayOff.findUnique({
          where: { staffId_date: { staffId, date: dateColumn(day) } },
        });
        if (off) return [];
        const shifts = await tx.workShift.findMany({
          where: { staffId, weekday: day.dayOfWeek },
          ...shiftFields,
        });
        // M5 sẽ đọc lịch giữ chỗ trong cùng snapshot rồi lọc các khoảng [startAt,endAt).
        return availableSlots(
          day,
          assignment.service.durationMinutes,
          shifts,
          now,
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
  private async lockStaff(tx: Prisma.TransactionClient, staffId: string) {
    // Tuần tự hóa thay đổi cấu hình của cùng nhân viên; M5 cần dùng cùng khóa khi đặt lịch.
    const rows = await tx.$queryRaw<
      { userId: string }[]
    >`SELECT "userId" FROM "StaffProfile" WHERE "userId"=${staffId}::uuid FOR UPDATE`;
    if (!rows.length) throw new NotFoundException();
  }
  async replaceDay(staffId: string, weekdayText: string, body: DayScheduleDto) {
    if (!/^[1-7]$/.test(weekdayText)) throw new BadRequestException();
    const weekday = Number(weekdayText);
    const shifts = validatedShifts(body.shifts);
    await this.db.$transaction(async (tx) => {
      await this.lockStaff(tx, staffId);
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
      await this.lockStaff(tx, staffId);
      if (off)
        await tx.dayOff.upsert({
          where: { staffId_date: { staffId, date } },
          create: { staffId, date },
          update: {},
        });
      else await tx.dayOff.deleteMany({ where: { staffId, date } });
    });
  }
}
