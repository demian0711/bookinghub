import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ScheduleService } from './schedule.service';
import {
  AvailabilityController,
  ScheduleController,
} from './schedule.controller';
@Module({
  imports: [PrismaModule],
  controllers: [AvailabilityController, ScheduleController],
  providers: [ScheduleService],
})
export class ScheduleModule {}
