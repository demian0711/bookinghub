import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ApiProperty,
  ApiPropertyOptional,
  IntersectionType,
  OmitType,
} from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID } from 'class-validator';
import { AppointmentQuery } from './appointments.dto';
import { salonDate } from '../schedule/salon-time';
import { dayBounds } from '../schedule/day-slots';
import { AppointmentStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
export class ReportRange {
  @ApiProperty({ format: 'date' }) @IsString() from!: string;
  @ApiProperty({ format: 'date' }) @IsString() to!: string;
}
export class SalonQuery extends IntersectionType(
  ReportRange,
  OmitType(AppointmentQuery, ['date'] as const),
) {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  serviceId?: string;
}
function appointmentRange({ from, to }: ReportRange) {
  const first = salonDate(from),
    last = salonDate(to);
  const distance = first.until(last).days;
  if (distance < 0 || distance >= 90) throw new BadRequestException();
  // Hai ngày đầu/cuối đều được chọn. Mốc kết thúc truy vấn là đầu ngày kế tiếp ở salon.
  return { gte: dayBounds(first).start, lt: dayBounds(last).end };
}
@Injectable()
export class AdminReports {
  constructor(private readonly db: PrismaService) {}
  async list(q: SalonQuery) {
    const where = {
      startAt: appointmentRange(q),
      staffId: q.staffId,
      status: q.status,
      serviceId: q.serviceId,
    };
    const [items, total] = await this.db.$transaction(
      [
        this.db.appointment.findMany({
          where,
          take: q.pageSize,
          skip: (q.page - 1) * q.pageSize,
          orderBy: [{ [q.sort]: q.order }, { id: 'asc' }],
          select: {
            id: true,
            serviceName: true,
            startAt: true,
            status: true,
            priceVnd: true,
            customer: { select: { displayName: true } },
            staff: { select: { user: { select: { displayName: true } } } },
          },
        }),
        this.db.appointment.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return { items, total, page: q.page, pageSize: q.pageSize };
  }
  async dashboard(q: ReportRange) {
    const where = { startAt: appointmentRange(q) };
    // Các nhóm và tên dịch vụ phải thuộc cùng một snapshot khi trạng thái đang thay đổi.
    return this.db.$transaction(
      async (tx) => {
        const groups = await tx.appointment.groupBy({
          by: ['status'],
          where,
          _count: { _all: true },
          _sum: { priceVnd: true },
        });
        const ranks = await tx.appointment.groupBy({
          by: ['serviceId'],
          where: { ...where, status: 'COMPLETED' },
          _count: { serviceId: true },
          orderBy: [{ _count: { serviceId: 'desc' } }, { serviceId: 'asc' }],
          take: 10,
        });
        const services = await tx.service.findMany({
          where: { id: { in: ranks.map((x) => x.serviceId) } },
          select: { id: true, name: true },
        });
        const counts = Object.fromEntries(
          Object.values(AppointmentStatus).map((s) => [s, 0]),
        ) as Record<AppointmentStatus, number>;
        let total = 0,
          completedValue = 0;
        for (const group of groups) {
          counts[group.status] = group._count._all;
          total += group._count._all;
          if (group.status === 'COMPLETED')
            completedValue = group._sum.priceVnd ?? 0;
        }
        const names = new Map(services.map((s) => [s.id, s.name]));
        return {
          from: q.from,
          to: q.to,
          total,
          counts,
          completedValue,
          cancellationRate: total ? counts.CANCELLED / total : null,
          popular: ranks.map((r) => ({
            id: r.serviceId,
            name: names.get(r.serviceId),
            count: r._count.serviceId,
          })),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
