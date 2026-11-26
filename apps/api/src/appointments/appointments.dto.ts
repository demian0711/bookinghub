import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsUUID, Matches } from 'class-validator';
import { AppointmentStatus } from '../generated/prisma/enums';

export class CreateAppointmentDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() staffId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() serviceId!: string;
  @ApiProperty({
    format: 'date-time',
    description: 'Dùng startAt của suất đã chọn, có Z hoặc offset.',
  })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(
    /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/,
  )
  startAt!: string;
}
export class AppointmentView {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) customerId!: string;
  @ApiProperty({ format: 'uuid' }) staffId!: string;
  @ApiProperty({ format: 'uuid' }) serviceId!: string;
  @ApiProperty({ format: 'date-time' }) startAt!: Date;
  @ApiProperty({ format: 'date-time' }) endAt!: Date;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty() serviceName!: string;
  @ApiProperty() priceVnd!: number;
  @ApiProperty() durationMinutes!: number;
  @ApiProperty({ enum: AppointmentStatus }) status!: AppointmentStatus;
}
