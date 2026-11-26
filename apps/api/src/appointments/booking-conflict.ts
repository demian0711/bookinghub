import { ConflictException } from '@nestjs/common';
export class BookingConflict extends ConflictException {
  constructor(
    readonly code: 'APPOINTMENT_SLOT_TAKEN' | 'SCHEDULE_AFFECTS_APPOINTMENTS',
    readonly appointmentIds?: string[],
  ) {
    super(
      code === 'APPOINTMENT_SLOT_TAKEN'
        ? 'Giờ này đã có lịch giữ chỗ.'
        : 'Thay đổi ảnh hưởng lịch đang giữ chỗ.',
    );
  }
}
