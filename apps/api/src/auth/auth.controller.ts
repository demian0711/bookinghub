import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { readEnvironment } from '../environment';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, PublicUser } from './auth.dto';
import { cookieName, PublicRoute, type SessionRequest } from './guards';

const csrfHeader = () =>
  ApiHeader({
    name: 'X-BookingHub-CSRF',
    required: true,
    schema: { type: 'string', enum: ['1'] },
    description: 'Gửi cùng Origin của web.',
  });
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly cookie = {
    httpOnly: true,
    secure: readEnvironment().mode === 'production',
    sameSite: 'lax' as const,
    path: '/api/v1',
  };
  constructor(private readonly auth: AuthService) {}
  @Post('register')
  @PublicRoute()
  @UseGuards(ThrottlerGuard)
  @csrfHeader()
  @ApiCreatedResponse({ type: PublicUser })
  @ApiResponse({ status: 409, description: 'Email đã tồn tại.' })
  @ApiResponse({ status: 429 })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  @PublicRoute()
  @UseGuards(ThrottlerGuard)
  @csrfHeader()
  @ApiOkResponse({ type: PublicUser })
  @ApiResponse({ status: 401 })
  @ApiResponse({ status: 429 })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, expiresAt, user } = await this.auth.login(dto);
    res.cookie(cookieName, token, { ...this.cookie, expires: expiresAt });
    return user;
  }
  @Get('me')
  @ApiCookieAuth(cookieName)
  @ApiOkResponse({ type: PublicUser })
  @ApiResponse({ status: 401 })
  me(@Req() req: SessionRequest) {
    return req.sessionIdentity.user;
  }

  @Post('logout')
  @HttpCode(204)
  @ApiCookieAuth(cookieName)
  @csrfHeader()
  @ApiNoContentResponse()
  @ApiResponse({ status: 401 })
  async logout(
    @Req() req: SessionRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(req.sessionIdentity.tokenHash);
    res.clearCookie(cookieName, this.cookie);
  }
}
