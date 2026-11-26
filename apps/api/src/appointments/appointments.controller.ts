import { Body, Controller, Post, Req } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { cookieName, Roles, type SessionRequest } from '../auth/guards';
import { AppointmentView, CreateAppointmentDto } from './appointments.dto';
import { AppointmentsService } from './appointments.service';

@Controller('appointments')
@ApiTags('appointments')
@Roles('CUSTOMER')
@ApiCookieAuth(cookieName)
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}
  @Post()
  @ApiHeader({
    name: 'X-BookingHub-CSRF',
    required: true,
    schema: { enum: ['1'] },
  })
  @ApiCreatedResponse({ type: AppointmentView })
  @ApiResponse({
    status: 409,
    description:
      'APPOINTMENT_SLOT_TAKEN: nhân viên đã có lịch giữ chỗ giao khoảng này.',
  })
  create(@Req() req: SessionRequest, @Body() body: CreateAppointmentDto) {
    return this.appointments.create(req.sessionIdentity.user.id, body);
  }
}
