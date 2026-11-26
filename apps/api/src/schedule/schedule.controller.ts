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
  Query,
} from '@nestjs/common';
import {
  ApiCookieAuth,
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
    summary: 'Giờ theo ca, khoảng nghỉ và ngày nghỉ. M4 chưa trừ lịch hẹn.',
  })
  list(@Query() query: AvailabilityQuery) {
    return this.schedules.availability(query);
  }
}
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
