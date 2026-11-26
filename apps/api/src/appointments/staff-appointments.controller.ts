import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiProperty,
  ApiResponse,
  ApiTags,
  PickType,
} from '@nestjs/swagger';
import { cookieName, Roles, type SessionRequest } from '../auth/guards';
import {
  AppointmentQuery,
  AppointmentView,
  TransitionDto,
} from './appointments.dto';
import { salonClock } from '../schedule/salon-time';
import { LifecycleService } from './lifecycle.service';
import { AppointmentStatus } from '../generated/prisma/enums';
class CustomerName {
  @ApiProperty() displayName!: string;
}
class StaffVisit extends PickType(AppointmentView, [
  'id',
  'serviceName',
  'priceVnd',
  'durationMinutes',
  'startAt',
  'endAt',
  'status',
] as const) {
  @ApiProperty({ type: CustomerName }) customer!: CustomerName;
}
class StaffEvent {
  @ApiProperty({ enum: AppointmentStatus }) status!: AppointmentStatus;
  @ApiProperty({ format: 'date-time' }) occurredAt!: Date;
  @ApiProperty({ type: String, nullable: true }) reason!: string | null;
}
class StaffVisitDetail extends StaffVisit {
  @ApiProperty({
    format: 'date-time',
    description: 'Giờ backend khi trả chi tiết.',
  })
  serverNow!: string;
  @ApiProperty({ type: [StaffEvent] }) events!: StaffEvent[];
}
class StaffVisitsPage {
  @ApiProperty({ type: [StaffVisit] }) items!: StaffVisit[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}
@ApiTags('staff/appointments')
@ApiCookieAuth(cookieName)
@Roles('STAFF')
@Controller('staff/appointments')
export class StaffAppointmentsController {
  constructor(private readonly lifecycle: LifecycleService) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({
    type: StaffVisitsPage,
    description: 'Lịch được giao trong ngày salon. Tham số date là bắt buộc.',
  })
  list(@Req() req: SessionRequest, @Query() query: AppointmentQuery) {
    if (!query.date) throw new BadRequestException();
    return this.lifecycle.list(req.sessionIdentity.user, query, 'staff');
  }
  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: StaffVisitDetail })
  @ApiResponse({
    status: 404,
    description: 'Lịch không tồn tại hoặc ngoài phân công.',
  })
  async detail(
    @Req() req: SessionRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const visit = await this.lifecycle.detail(
      req.sessionIdentity.user,
      id,
      'staff',
    );
    return { ...visit, serverNow: salonClock.now().toString() };
  }
  @Patch(':id/status')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiResponse({
    status: 409,
    description:
      'Trạng thái hoặc thời gian không còn phù hợp. Tải lại lịch hẹn.',
  })
  @ApiHeader({
    name: 'X-BookingHub-CSRF',
    required: true,
    schema: { enum: ['1'] },
  })
  async transition(
    @Req() req: SessionRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TransitionDto,
  ) {
    await this.lifecycle.transition(req.sessionIdentity.user, id, body);
  }
}
