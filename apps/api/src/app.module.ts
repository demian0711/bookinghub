import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health.controller';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { ScheduleModule } from './schedule/schedule.module';
import { AppointmentsModule } from './appointments/appointments.module';
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CatalogModule,
    ScheduleModule,
    AppointmentsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
