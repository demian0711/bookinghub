import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';

export class HoursDto {
  @ApiProperty({ example: '09:00', description: 'HH:mm theo giờ salon.' })
  @IsString()
  start!: string;
  @ApiProperty({ example: '12:00', description: 'Cho phép 24:00 ở cuối ngày.' })
  @IsString()
  end!: string;
}
export class ShiftDto extends HoursDto {
  @ApiProperty({ type: [HoursDto], default: [] })
  @IsArray()
  @ArrayMaxSize(1440)
  @ValidateNested({ each: true })
  @Type(() => HoursDto)
  breaks: HoursDto[] = [];
}
export class DayScheduleDto {
  @ApiProperty({ type: [ShiftDto] })
  @IsArray()
  @ArrayMaxSize(1440)
  @ValidateNested({ each: true })
  @Type(() => ShiftDto)
  shifts!: ShiftDto[];
}
export class AvailabilityQuery {
  @ApiProperty({ format: 'uuid' }) @IsUUID() serviceId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() staffId!: string;
  @ApiProperty({ format: 'date' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;
}
export class SlotDto {
  @ApiProperty({ format: 'date-time' }) startAt!: string;
  @ApiProperty({ format: 'date-time' }) endAt!: string;
}
export class AvailabilityView extends AvailabilityQuery {
  @ApiProperty({ example: 'Asia/Ho_Chi_Minh' }) timeZone!: string;
  @ApiProperty({ type: [SlotDto] }) slots!: SlotDto[];
}
export class WeekdayView extends DayScheduleDto {
  @ApiProperty({ minimum: 1, maximum: 7 }) weekday!: number;
}
export class ScheduleView {
  @ApiProperty({ type: [WeekdayView] }) week!: WeekdayView[];
  @ApiProperty({ type: [String], example: ['2026-12-01'] }) daysOff!: string[];
}

export class MoveDayOffDto {
  @ApiProperty({ format: 'date', description: 'Ngày nghỉ mới theo giờ salon.' })
  @IsString()
  date!: string;
}
export class AffectedAppointmentView extends SlotDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['PENDING', 'CONFIRMED'] }) status!: string;
}
export class ScheduleImpactView {
  @ApiProperty({ type: [AffectedAppointmentView] })
  affectedAppointments!: AffectedAppointmentView[];
}
