import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../generated/prisma/enums';

export class LoginDto {
  @ApiProperty({ format: 'email' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({ allow_utf8_local_part: false })
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    format: 'password',
    minLength: 12,
    maxLength: 128,
    writeOnly: true,
  })
  @IsString()
  @Length(12, 128)
  password!: string;
}

export class RegisterDto extends LoginDto {
  @ApiProperty({ minLength: 1, maxLength: 100 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 100)
  displayName!: string;
}

export class PublicUser {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ enum: Role }) role!: Role;
}
export const publicFields = {
  id: true,
  email: true,
  displayName: true,
  role: true,
} as const;
