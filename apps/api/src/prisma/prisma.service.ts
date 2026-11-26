import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { readEnvironment } from '../environment';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    // Kết nối khi truy vấn để liveness vẫn hoạt động nếu PostgreSQL đang khởi động.
    super({
      adapter: new PrismaPg({
        connectionString: readEnvironment().databaseUrl,
        connectionTimeoutMillis: 2000,
        query_timeout: 3000,
      }),
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
