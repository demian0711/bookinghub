import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CatalogService } from './catalog.service';
import {
  PublicCatalogController,
  AdminCatalogController,
} from './catalog.controller';
@Module({
  imports: [PrismaModule],
  providers: [CatalogService],
  controllers: [PublicCatalogController, AdminCatalogController],
})
export class CatalogModule {}
