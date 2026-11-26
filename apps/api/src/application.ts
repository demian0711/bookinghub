import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { readEnvironment } from './environment';

import { BadRequestException, Type, ValidationPipe } from '@nestjs/common';
import { ApiErrorFilter } from './api-error.filter';
import { cookieName } from './auth/guards';
import type { Request, Response, NextFunction } from 'express';

export async function createApplication(rootModule: Type = AppModule) {
  const { mode } = readEnvironment();
  const app = await NestFactory.create(rootModule);
  app.use(
    '/api/v1/auth',
    (_req: Request, res: Response, next: NextFunction) => {
      res.setHeader('Cache-Control', 'no-store');
      next();
    },
  );
  app.useGlobalFilters(new ApiErrorFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
      exceptionFactory: () => new BadRequestException(),
    }),
  );
  app.setGlobalPrefix('api/v1');
  if (mode === 'development') {
    const config = new DocumentBuilder()
      .setTitle('BookingHub API')
      .setDescription(
        'Các thao tác ghi yêu cầu WEB_ORIGIN và X-BookingHub-CSRF: 1. Xem hướng dẫn HTTP trong docs/setup.md.',
      )
      .addCookieAuth(cookieName, { type: 'apiKey', in: 'cookie' }, cookieName)
      .setVersion('1')
      .build();
    SwaggerModule.setup('api/docs', app, () =>
      SwaggerModule.createDocument(app, config),
    );
  }
  app.enableShutdownHooks();
  return app;
}
