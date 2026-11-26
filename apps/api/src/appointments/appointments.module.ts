import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { LifecycleService } from './lifecycle.service';
import { StaffAppointmentsController } from './staff-appointments.controller';
import { AdminReports } from './admin-reports';
import { AdminAppointmentsController } from './admin-appointments.controller';
@Module({
  imports: [PrismaModule],
  controllers: [
    AppointmentsController,
    StaffAppointmentsController,
    AdminAppointmentsController,
  ],
  providers: [AppointmentsService, LifecycleService, AdminReports],
})
export class AppointmentsModule {}
