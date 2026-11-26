import {
  Controller,
  Get,
  Header,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse } from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ description: 'Tiến trình API đang chạy.' })
  health() {
    return { status: 'ok' };
  }

  @Get('ready')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ description: 'Truy vấn PostgreSQL thành công.' })
  @ApiServiceUnavailableResponse({ description: 'Database chưa sẵn sàng.' })
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready' };
    } catch {
      throw new ServiceUnavailableException('Database chưa sẵn sàng.');
    }
  }
}
