import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { STATUS_CODES } from 'node:http';
import type { Response } from 'express';

import { BookingConflict } from './appointments/booking-conflict';
const messages: Record<number, string> = {
  400: 'Dữ liệu yêu cầu không hợp lệ.',
  401: 'Cần đăng nhập hoặc thông tin đăng nhập không hợp lệ.',
  403: 'Yêu cầu không được phép.',
  404: 'Không tìm thấy tài nguyên.',
  409: 'Email đã được sử dụng.',
  429: 'Quá nhiều yêu cầu. Hãy thử lại sau.',
  503: 'Database chưa sẵn sàng.',
};

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const status = error instanceof HttpException ? error.getStatus() : 500;
    // Chỉ gửi thông báo đã định nghĩa vì lỗi parser hoặc ORM có thể chứa dữ liệu đầu vào.
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({
        statusCode: status,
        error: STATUS_CODES[status] ?? 'Error',
        message:
          error instanceof BookingConflict
            ? error.message
            : (messages[status] ?? 'Không thể xử lý yêu cầu.'),
        ...(error instanceof BookingConflict
          ? {
              code: error.code,
              appointmentIds: error.affectedAppointments?.map((a) => a.id),
              affectedAppointments: error.affectedAppointments,
            }
          : {}),
      });
  }
}
