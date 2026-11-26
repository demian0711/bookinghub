import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health.controller';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
@Module({
  imports: [PrismaModule, AuthModule, CatalogModule],
  controllers: [HealthController],
})
export class AppModule {}
