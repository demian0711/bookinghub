import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Temporal } from '@js-temporal/polyfill';
import { PrismaService } from '../prisma/prisma.service';
import { lockStaff } from '../prisma/staff-lock';
import { bookingDay, salonZone, salonClock } from '../schedule/salon-time';
import { configuredSlots } from '../schedule/day-slots';
import { BookingConflict } from './booking-conflict';
import { CreateAppointmentDto } from './appointments.dto';

@Injectable()
export class AppointmentsService {
  constructor(private readonly db: PrismaService) {}
  async create(
    customerId: string,
    { staffId, serviceId, startAt }: CreateAppointmentDto,
  ) {
    let instant: Temporal.Instant;
    try {
      instant = Temporal.Instant.from(startAt);
    } catch {
      throw new BadRequestException();
    }
    const local = instant.toZonedDateTimeISO(salonZone);
    return this.db.$transaction(
      async (tx) => {
        // Thứ tự chung: hồ sơ nhân viên → dịch vụ → khách. Đọc lại cấu hình sau khi có đủ khóa.
        await lockStaff(tx, staffId);
        const services = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM "Service" WHERE id=${serviceId}::uuid FOR SHARE`;
        if (!services.length) throw new NotFoundException();
        const customers = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM "User" WHERE id=${customerId}::uuid AND role='CUSTOMER' AND active FOR SHARE`;
        if (!customers.length) throw new ForbiddenException();
        const now = salonClock.now();
        const day = bookingDay(local.toPlainDate().toString(), now);
        const { service, slots } = await configuredSlots(
          tx,
          staffId,
          serviceId,
          day,
          now,
        );
        const slot = slots.find(
          (s) => Temporal.Instant.compare(s.startAt, instant) === 0,
        );
        if (!slot || Temporal.Instant.compare(instant, salonClock.now()) < 0)
          throw new BadRequestException();
        const id = randomUUID();
        // Chỉ constraint giữ chỗ có thể bỏ qua dòng này. Các lỗi FK, CHECK, trigger phải rollback.
        const inserted = await tx.$executeRaw`INSERT INTO "Appointment"
       (id,"customerId","staffId","serviceId","startAt","endAt","serviceName","priceVnd","durationMinutes")
       VALUES (${id}::uuid,${customerId}::uuid,${staffId}::uuid,${serviceId}::uuid,
               ${slot.startAt}::timestamptz,${slot.endAt}::timestamptz,${service.name},${service.priceVnd},${service.durationMinutes})
       ON CONFLICT ON CONSTRAINT appointment_staff_held_excl DO NOTHING`;
        if (inserted === 0) throw new BookingConflict('APPOINTMENT_SLOT_TAKEN');
        return tx.appointment.findUniqueOrThrow({ where: { id } });
      },
      { isolationLevel: 'ReadCommitted' },
    );
  }
}
