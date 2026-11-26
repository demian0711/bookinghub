import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { readEnvironment } from './environment';

export async function createApplication() {
  const { mode } = readEnvironment();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  if (mode === 'development') {
    const config = new DocumentBuilder()
      .setTitle('BookingHub API')
      .setVersion('1')
      .build();
    SwaggerModule.setup('api/docs', app, () =>
      SwaggerModule.createDocument(app, config),
    );
  }
  app.enableShutdownHooks();
  return app;
}
