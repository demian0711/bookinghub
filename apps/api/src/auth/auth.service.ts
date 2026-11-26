import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';
import { verify } from '@node-rs/argon2';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { LoginDto, RegisterDto, publicFields } from './auth.dto';
import { hashPassword } from './password';

export const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;
function digest(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  // Giữ cùng bước xác minh mật khẩu cho email chưa đăng ký.
  private readonly dummyHash = hashPassword(randomBytes(32).toString('hex'));
  constructor(private readonly db: PrismaService) {}
  async register({ email, password, displayName }: RegisterDto) {
    const passwordHash = await hashPassword(password);
    try {
      return await this.db.user.create({
        data: { email, passwordHash, displayName, role: 'CUSTOMER' },
        select: publicFields,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('Email đã được sử dụng.');
      throw error;
    }
  }
  async login({ email, password }: LoginDto) {
    const account = await this.db.user.findUnique({
      where: { email },
      select: { ...publicFields, active: true, passwordHash: true },
    });
    const valid = await verify(
      account?.passwordHash ?? (await this.dummyHash),
      password,
    );
    if (!account?.active || !valid)
      throw new UnauthorizedException('Thông tin đăng nhập không hợp lệ.');
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + sessionLifetimeMs);
    await this.db.session.create({
      data: { userId: account.id, tokenHash: digest(token), expiresAt },
    });
    return {
      token,
      expiresAt,
      user: {
        id: account.id,
        email: account.email,
        displayName: account.displayName,
        role: account.role,
      },
    };
  }
  async authenticate(token: string | undefined) {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new UnauthorizedException();
    // Đọc quyền và trạng thái hiện tại mỗi lần để khóa tài khoản hoặc đổi vai trò có hiệu lực ngay.
    const session = await this.db.session.findFirst({
      where: {
        tokenHash: digest(token),
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { active: true },
      },
      select: { tokenHash: true, user: { select: publicFields } },
    });
    if (!session) throw new UnauthorizedException();
    return session;
  }
  async logout(tokenHash: string) {
    await this.db.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
