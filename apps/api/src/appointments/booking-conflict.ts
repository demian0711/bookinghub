import { ConflictException } from '@nestjs/common';
export interface AffectedAppointment {
  id: string;
  startAt: Date;
  endAt: Date;
  status: string;
}

export class BookingConflict extends ConflictException {
  constructor(
    readonly code:
      | 'APPOINTMENT_STATE_CONFLICT'
      | 'APPOINTMENT_SLOT_TAKEN'
      | 'SCHEDULE_AFFECTS_APPOINTMENTS'
      | 'DAY_OFF_ALREADY_EXISTS',
    readonly affectedAppointments?: AffectedAppointment[],
  ) {
    super(
      code === 'APPOINTMENT_STATE_CONFLICT'
        ? 'Trạng thái hoặc thời điểm hiện tại không cho phép thao tác này.'
        : code === 'APPOINTMENT_SLOT_TAKEN'
          ? 'Giờ này đã có lịch giữ chỗ.'
          : code === 'DAY_OFF_ALREADY_EXISTS'
            ? 'Nhân viên đã có ngày nghỉ vào ngày đích.'
            : 'Thay đổi ảnh hưởng lịch đang giữ chỗ.',
    );
  }
}
