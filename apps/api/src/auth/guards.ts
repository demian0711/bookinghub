import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { parse } from 'cookie';
import { Role } from '../generated/prisma/enums';
import { readEnvironment } from '../environment';
import { AuthService } from './auth.service';

export const cookieName = 'bookinghub_session';
export const PublicRoute = () => SetMetadata('auth:public', true);
export const Roles = (...roles: Role[]) => SetMetadata('auth:roles', roles);
export interface SessionRequest extends Request {
  sessionIdentity: Awaited<ReturnType<AuthService['authenticate']>>;
}

@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly origin = readEnvironment().webOrigin;
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
    // Origin lấy từ cấu hình. Header riêng buộc trình duyệt khác origin phải qua preflight.
    if (
      req.headers.origin !== this.origin ||
      req.headers['x-bookinghub-csrf'] !== '1'
    )
      throw new ForbiddenException('Yêu cầu CSRF không hợp lệ.');
    return true;
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>('auth:public', [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<SessionRequest>();
    request.sessionIdentity = await this.auth.authenticate(
      parse(request.headers.cookie ?? '')[cookieName],
    );
    return true;
  }
}

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<Role[]>('auth:roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles) return true;
    const identity = context
      .switchToHttp()
      .getRequest<SessionRequest>().sessionIdentity;
    if (!identity || !roles.includes(identity.user.role))
      throw new ForbiddenException();
    return true;
  }
}
