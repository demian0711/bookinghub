import {
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
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles, cookieName, type SessionRequest } from '../auth/guards';
import { salonClock } from '../schedule/salon-time';
import { AdminReports, ReportRange, SalonQuery } from './admin-reports';
import { LifecycleService } from './lifecycle.service';
import { TransitionDto } from './appointments.dto';
@Controller('admin')
@ApiTags('admin/operations')
@Roles('ADMIN')
@ApiCookieAuth(cookieName)
export class AdminAppointmentsController {
  constructor(
    private readonly reports: AdminReports,
    private readonly lifecycle: LifecycleService,
  ) {}
  @Get('dashboard')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary: 'Tổng hợp theo ngày bắt đầu lịch tại salon, tối đa 90 ngày.',
  })
  dashboard(@Query() q: ReportRange) {
    return this.reports.dashboard(q);
  }
  @Get('appointments') @Header('Cache-Control', 'private, no-store') list(
    @Query() q: SalonQuery,
  ) {
    return this.reports.list(q);
  }
  @Get('appointments/:id')
  @Header('Cache-Control', 'private, no-store')
  async detail(
    @Req() req: SessionRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const row = await this.lifecycle.detail(
      req.sessionIdentity.user,
      id,
      'admin',
    );
    return { ...row, serverNow: salonClock.now().toString() };
  }
  @Patch('appointments/:id/status')
  @HttpCode(204)
  @ApiHeader({ name: 'X-BookingHub-CSRF', required: true })
  async transition(
    @Req() req: SessionRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TransitionDto,
  ) {
    await this.lifecycle.transition(req.sessionIdentity.user, id, body);
  }
}
