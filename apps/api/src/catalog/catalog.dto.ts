import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  PickType,
} from '@nestjs/swagger';
import { RegisterDto } from '../auth/auth.dto';

const trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
const optional = () =>
  ValidateIf((_object: unknown, value: unknown) => value !== undefined);

export class ServiceDto {
  @ApiProperty({ maxLength: 120 })
  @trim()
  @IsString()
  @Length(1, 120)
  name!: string;
  @ApiProperty({ maxLength: 1000 })
  @trim()
  @IsString()
  @MaxLength(1000)
  description!: string;
  @ApiProperty({ minimum: 0, maximum: 10000000, type: 'integer' })
  @IsInt()
  @Min(0)
  @Max(10000000)
  priceVnd!: number;
  @ApiProperty({ minimum: 1, maximum: 480, type: 'integer' })
  @IsInt()
  @Min(1)
  @Max(480)
  durationMinutes!: number;
}
export class EditServiceDto extends PartialType(ServiceDto, {
  skipNullProperties: false,
}) {
  @ApiPropertyOptional() @optional() @IsBoolean() active?: boolean;
}
export class CreateStaffDto extends RegisterDto {
  @ApiPropertyOptional({ maxLength: 1000 })
  @optional()
  @trim()
  @IsString()
  @MaxLength(1000)
  bio?: string;
}
export class EditStaffDto extends PartialType(
  PickType(CreateStaffDto, ['displayName', 'bio']),
  { skipNullProperties: false },
) {
  @ApiPropertyOptional() @optional() @IsBoolean() active?: boolean;
}
export class AssignmentsDto {
  @ApiProperty({
    type: [String],
    description: 'Danh sách UUID dịch vụ thay thế toàn bộ phân công.',
  })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((id: unknown) =>
          typeof id === 'string' ? id.toLowerCase() : id,
        )
      : value,
  )
  serviceIds!: string[];
}

class PageQuery {
  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 1000000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20;
  @ApiPropertyOptional()
  @optional()
  @trim()
  @IsString()
  @MaxLength(120)
  q?: string;
  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'asc';
}
export class ServiceQuery extends PageQuery {
  @ApiPropertyOptional({ enum: ['name', 'priceVnd', 'durationMinutes'] })
  @IsIn(['name', 'priceVnd', 'durationMinutes'])
  sort: 'name' | 'priceVnd' | 'durationMinutes' = 'name';
}
export class StaffQuery extends PageQuery {
  @ApiPropertyOptional({ enum: ['displayName'] })
  @IsIn(['displayName'])
  sort = 'displayName';
}
export class ServiceView extends ServiceDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
}
export class StaffView {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty() bio!: string;
}
export class AdminServiceView extends ServiceView {
  @ApiProperty() active!: boolean;
}
export class AdminStaffView extends StaffView {
  @ApiProperty() email!: string;
  @ApiProperty() active!: boolean;
  @ApiProperty({ type: [String] }) serviceIds!: string[];
}
