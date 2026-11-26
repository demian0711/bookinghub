import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Put,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiConflictResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { cookieName, PublicRoute, Roles } from '../auth/guards';
import {
  AvailabilityQuery,
  AvailabilityView,
  DayScheduleDto,
  ScheduleView,
  MoveDayOffDto,
  ScheduleImpactView,
} from './schedule.dto';
import { ScheduleService } from './schedule.service';

@Controller('availability')
@ApiTags('availability')
@PublicRoute()
export class AvailabilityController {
  constructor(private readonly schedules: ScheduleService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: AvailabilityView })
  @ApiOperation({
    summary:
      'Giờ phù hợp lịch làm việc, đã loại các lịch PENDING và CONFIRMED của nhân viên.',
  })
  list(@Query() query: AvailabilityQuery) {
    return this.schedules.availability(query);
  }
}
const ScheduleConflictResponse = () =>
  ApiConflictResponse({
    description:
      'SCHEDULE_AFFECTS_APPOINTMENTS trả appointmentIds và affectedAppointments (id, startAt, endAt, status). Khi đổi ngày nghỉ, DAY_OFF_ALREADY_EXISTS cho biết ngày đích đã là ngày nghỉ.',
  });
const WriteHeader = () =>
  ApiHeader({
    name: 'X-BookingHub-CSRF',
    required: true,
    schema: { enum: ['1'] },
    description: 'Gửi cùng Origin của web.',
  });
@Controller('admin/staff/:staffId/schedule')
@ApiTags('admin/schedule')
@Roles('ADMIN')
@ApiCookieAuth(cookieName)
export class ScheduleController {
  constructor(private readonly schedules: ScheduleService) {}
  @Get()
  @ApiOkResponse({ type: ScheduleView })
  get(@Param('staffId', ParseUUIDPipe) staffId: string) {
    return this.schedules.schedule(staffId);
  }
  @Post('week/:weekday/preview')
  @HttpCode(200)
  @WriteHeader()
  @ApiOkResponse({ type: ScheduleImpactView })
  @ApiOperation({
    summary:
      'Xem các lịch bị ảnh hưởng nếu thay toàn bộ ca của thứ này. Lúc lưu sẽ kiểm tra lại.',
  })
  preview(
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Param('weekday') weekday: string,
    @Body() body: DayScheduleDto,
  ) {
    return this.schedules.previewDay(staffId, weekday, body);
  }
  @ScheduleConflictResponse()
  @Put('week/:weekday')
  @HttpCode(204)
  @ApiNoContentResponse()
  @WriteHeader()
  @ApiParam({ name: 'weekday', description: '1 = thứ Hai … 7 = Chủ nhật' })
  @ApiOperation({
    summary:
      'Thay toàn bộ ca và khoảng nghỉ của một thứ; mảng ca rỗng xóa cấu hình ca của thứ đó.',
  })
  replace(
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Param('weekday') weekday: string,
    @Body() body: DayScheduleDto,
  ) {
    return this.schedules.replaceDay(staffId, weekday, body);
  }
  @ScheduleConflictResponse()
  @Put('days-off/:date')
  @HttpCode(204)
  @ApiNoContentResponse()
  @WriteHeader()
  @ApiParam({ name: 'date', schema: { type: 'string', format: 'date' } })
  add(
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Param('date') date: string,
  ) {
    return this.schedules.setDayOff(staffId, date, true);
  }
  @Patch('days-off/:date')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ScheduleConflictResponse()
  @WriteHeader()
  @ApiOperation({
    summary: 'Chuyển ngày nghỉ sang ngày mới trong một giao dịch.',
  })
  move(
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Param('date') date: string,
    @Body() body: MoveDayOffDto,
  ) {
    return this.schedules.moveDayOff(staffId, date, body.date);
  }
  @Delete('days-off/:date')
  @HttpCode(204)
  @ApiNoContentResponse()
  @WriteHeader()
  @ApiParam({ name: 'date', schema: { type: 'string', format: 'date' } })
  remove(
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Param('date') date: string,
  ) {
    return this.schedules.setDayOff(staffId, date, false);
  }
}
