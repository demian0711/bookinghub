import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class AppointmentQuery {
  @ApiPropertyOptional({
    format: 'date',
    description: 'Ngày bắt đầu lịch theo giờ salon.',
  })
  @IsOptional()
  @IsString()
  date?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  staffId?: string;
  @ApiPropertyOptional({ enum: AppointmentStatus })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;
  @ApiPropertyOptional({ default: 1, maximum: 1000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page = 1;
  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20;
  @ApiPropertyOptional({ enum: ['startAt', 'createdAt'], default: 'startAt' })
  @IsIn(['startAt', 'createdAt'])
  sort: 'startAt' | 'createdAt' = 'startAt';
  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'asc';
}
export class TransitionDto {
  @ApiProperty({
    enum: AppointmentStatus,
    description: 'Trạng thái nguồn đã đọc.',
  })
  @IsEnum(AppointmentStatus)
  expectedStatus!: AppointmentStatus;
  @ApiProperty({ enum: ['CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'] })
  @IsIn(['CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'])
  status!: Exclude<AppointmentStatus, 'PENDING'>;
  @ApiPropertyOptional({
    maxLength: 500,
    description: 'Lý do hủy. Bắt buộc với nhân viên và admin.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
class AppointmentEventView {
  @ApiProperty({ format: 'uuid' }) actorId!: string;
  @ApiProperty({ enum: AppointmentStatus, nullable: true })
  previousStatus!: AppointmentStatus | null;
  @ApiProperty({ enum: AppointmentStatus }) status!: AppointmentStatus;
  @ApiProperty({ format: 'date-time' }) occurredAt!: Date;
  @ApiProperty({ type: String, nullable: true }) reason!: string | null;
}
export class AppointmentDetail extends AppointmentView {
  @ApiProperty({ type: [AppointmentEventView] })
  events!: AppointmentEventView[];
}
export class AppointmentPage {
  @ApiProperty({ type: [AppointmentView] }) items!: AppointmentView[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}
