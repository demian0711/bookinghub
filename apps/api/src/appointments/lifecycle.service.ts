import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { lockStaff } from '../prisma/staff-lock';
import { salonDate, salonClock } from '../schedule/salon-time';
import { dayBounds } from '../schedule/day-slots';
import { AppointmentQuery, TransitionDto } from './appointments.dto';
import { BookingConflict } from './booking-conflict';

type Actor = { id: string; role: Role };
function scope(actor: Actor): Prisma.AppointmentWhereInput {
  switch (actor.role) {
    case 'CUSTOMER':
      return { customerId: actor.id };
    case 'STAFF':
      return { staffId: actor.id };
    case 'ADMIN':
      return {};
  }
}
const events = {
  select: {
    actorId: true,
    previousStatus: true,
    status: true,
    occurredAt: true,
    reason: true,
  },
  orderBy: [
    { occurredAt: 'asc' },
    { previousStatus: { sort: 'asc', nulls: 'first' } },
  ],
} satisfies Prisma.AppointmentEventFindManyArgs;

// Nhân viên cần tên hiển thị để đón khách. Giới hạn các trường ngay trong truy vấn.
const staffFields = {
  id: true,
  serviceName: true,
  priceVnd: true,
  durationMinutes: true,
  startAt: true,
  endAt: true,
  status: true,
  customer: { select: { displayName: true } },
} satisfies Prisma.AppointmentSelect;
const staffDetailFields = {
  ...staffFields,
  events: {
    ...events,
    select: { status: true, occurredAt: true, reason: true },
  },
} satisfies Prisma.AppointmentSelect;

@Injectable()
export class LifecycleService {
  constructor(private readonly db: PrismaService) {}
  async list(
    actor: Actor,
    query: AppointmentQuery,
    view: 'standard' | 'staff' = 'standard',
  ) {
    const { date, status, staffId, page, pageSize, sort, order } = query;
    const bounds = date === undefined ? undefined : dayBounds(salonDate(date));
    // Giao bộ lọc với phạm vi từ phiên, kể cả khi nhân viên lọc theo người khác.
    const where: Prisma.AppointmentWhereInput = {
      AND: [
        scope(actor),
        {
          staffId,
          status,
          startAt: bounds && { gte: bounds.start, lt: bounds.end },
        },
      ],
    };
    const [items, total] = await this.db.$transaction(
      [
        this.db.appointment.findMany({
          where,
          select: view === 'staff' ? staffFields : undefined,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: [{ [sort]: order }, { id: 'asc' }],
        }),
        this.db.appointment.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return { items, total, page, pageSize };
  }
  async detail(
    actor: Actor,
    id: string,
    view: 'standard' | 'staff' | 'admin' = 'standard',
  ) {
    const where = { id, ...scope(actor) };
    const row = await this.db.$transaction(
      async (tx) =>
        view === 'admin'
          ? tx.appointment.findFirst({
              where,
              select: {
                ...staffDetailFields,
                staff: { select: { user: { select: { displayName: true } } } },
              },
            })
          : view === 'staff'
            ? tx.appointment.findFirst({ where, select: staffDetailFields })
            : tx.appointment.findFirst({ where, include: { events } }),
      { isolationLevel: 'RepeatableRead' },
    );
    if (!row) throw new NotFoundException();
    return row;
  }
  async transition(actor: Actor, id: string, body: TransitionDto) {
    const { expectedStatus, status } = body;
    const where = { id, ...scope(actor) };
    return this.db.$transaction(
      async (tx) => {
        const row = await tx.appointment.findFirst({
          where,
          select: { staffId: true, startAt: true, endAt: true },
        });
        if (!row) throw new NotFoundException();
        if (actor.role === 'CUSTOMER' && status !== 'CANCELLED')
          throw new ForbiddenException();
        const reason = body.reason?.trim() || '';
        if (
          (status === 'CANCELLED' && actor.role !== 'CUSTOMER' && !reason) ||
          (status !== 'CANCELLED' && body.reason != null)
        )
          throw new BadRequestException();
        // Lấy cùng khóa với đặt lịch và đổi ca trước khi đọc đồng hồ, giữ đến khi lịch sử đã ghi.
        await lockStaff(tx, row.staffId);
        const now = salonClock.now().epochMilliseconds;
        if (expectedStatus !== 'PENDING' && expectedStatus !== 'CONFIRMED')
          throw new BookingConflict('APPOINTMENT_STATE_CONFLICT');
        switch (status) {
          case 'CONFIRMED':
            if (expectedStatus !== 'PENDING')
              throw new BookingConflict('APPOINTMENT_STATE_CONFLICT');
            break;
          case 'CANCELLED':
            if (
              actor.role === 'CUSTOMER' &&
              row.startAt.getTime() - now < 2 * 60 * 60 * 1000
            )
              throw new BookingConflict('APPOINTMENT_STATE_CONFLICT');
            break;
          case 'COMPLETED':
          case 'NO_SHOW': {
            const earliest = status === 'COMPLETED' ? row.endAt : row.startAt;
            if (expectedStatus !== 'CONFIRMED' || now < earliest.getTime())
              throw new BookingConflict('APPOINTMENT_STATE_CONFLICT');
            break;
          }
        }
        await tx.$queryRaw`SELECT set_config('bookinghub.actor_id',${actor.id},true), set_config('bookinghub.cancel_reason',${reason},true) AS reason`;
        // Chỉ một yêu cầu có thể ghi từ trạng thái nguồn đã đọc.
        const change = await tx.appointment.updateMany({
          where: { ...where, status: expectedStatus },
          data: { status },
        });
        if (change.count !== 1)
          throw new BookingConflict('APPOINTMENT_STATE_CONFLICT');
        return tx.appointment.findUniqueOrThrow({
          where: { id },
          include: { events },
        });
      },
      { isolationLevel: 'ReadCommitted' },
    );
  }
}
