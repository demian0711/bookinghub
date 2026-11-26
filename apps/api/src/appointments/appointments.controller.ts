import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { cookieName, Roles, type SessionRequest } from '../auth/guards';
import {
  AppointmentView,
  CreateAppointmentDto,
  AppointmentQuery,
  TransitionDto,
  AppointmentDetail,
  AppointmentPage,
} from './appointments.dto';
import { AppointmentsService } from './appointments.service';

import { LifecycleService } from './lifecycle.service';
@Controller('appointments')
@ApiTags('appointments')
@Roles('CUSTOMER', 'STAFF', 'ADMIN')
@ApiCookieAuth(cookieName)
export class AppointmentsController {
  constructor(
    private readonly appointments: AppointmentsService,
    private readonly lifecycle: LifecycleService,
  ) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'Danh sách trong phạm vi của người đăng nhập.' })
  @ApiOkResponse({ type: AppointmentPage })
  list(@Req() req: SessionRequest, @Query() query: AppointmentQuery) {
    return this.lifecycle.list(req.sessionIdentity.user, query);
  }

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: AppointmentDetail })
  @ApiResponse({
    status: 404,
    description: 'Lịch không tồn tại hoặc ngoài phạm vi.',
  })
  detail(@Req() req: SessionRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.lifecycle.detail(req.sessionIdentity.user, id);
  }

  @Patch(':id/status')
  @ApiHeader({
    name: 'X-BookingHub-CSRF',
    required: true,
    schema: { enum: ['1'] },
  })
  @ApiOperation({
    summary:
      'Đổi trạng thái theo quyền, trạng thái nguồn và thời điểm của salon.',
  })
  @ApiOkResponse({ type: AppointmentDetail })
  @ApiResponse({
    status: 409,
    description:
      'APPOINTMENT_STATE_CONFLICT: đọc lại lịch và kiểm tra mốc thời gian.',
  })
  transition(
    @Req() req: SessionRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TransitionDto,
  ) {
    return this.lifecycle.transition(req.sessionIdentity.user, id, body);
  }
  @Post()
  @Roles('CUSTOMER')
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
