import { PrismaService } from './prisma/prisma.service';
import { hashPassword } from './auth/password';
import { Role } from './generated/prisma/enums';
import { readEnvironment } from './environment';

async function seed() {
  const { databaseUrl } = readEnvironment();
  const url = new URL(databaseUrl);
  if (
    process.env.NODE_ENV !== 'development' ||
    process.env.ALLOW_DEMO_SEED !== '1' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  ) {
    throw new Error(
      'Seed yêu cầu development, PostgreSQL loopback và ALLOW_DEMO_SEED=1.',
    );
  }
  const data = await Promise.all(
    Object.values(Role).map(async (role) => {
      const password = process.env[`DEMO_${role}_PASSWORD`];
      if (!password || password.length < 12 || password.length > 128)
        throw new Error('Cần đặt ba mật khẩu demo dài 12–128 ký tự.');
      return {
        email: `${role.toLowerCase()}@demo.bookinghub.test`,
        role,
        displayName: `BookingHub ${role}`,
        passwordHash: await hashPassword(password),
      };
    }),
  );
  const db = new PrismaService();
  try {
    // Một lần ghi cho cả bộ demo. Chạy lại giữ nguyên mật khẩu và quyền của tài khoản đã tồn tại.
    const { count } = await db.user.createMany({ data, skipDuplicates: true });
    console.log(`Đã tạo ${count} tài khoản demo.`);
  } finally {
    await db.$disconnect();
  }
}
seed().catch(() => {
  console.error(
    'Seed thất bại. Kiểm tra môi trường, mật khẩu demo và migration.',
  );
  process.exitCode = 1;
});
