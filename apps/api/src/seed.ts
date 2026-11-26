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
    await db.$transaction(async (tx) => {
      await tx.user.createMany({ data, skipDuplicates: true });
      const user = await tx.user.findUniqueOrThrow({
        where: { email: 'staff@demo.bookinghub.test' },
        select: { id: true, role: true },
      });
      if (user.role !== 'STAFF')
        throw new Error('Email demo đã thuộc tài khoản khác vai trò.');
      await tx.staffProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id },
        update: {},
      });
      // Một thứ đã cấu hình (kể cả để trống) được giữ nguyên khi chạy lại seed.
      for (const weekday of [1, 2, 3, 4, 5, 6]) {
        await tx.workDay.upsert({
          where: { staffId_weekday: { staffId: user.id, weekday } },
          create: {
            staffId: user.id,
            weekday,
            shifts: {
              create: {
                startMinute: 540,
                endMinute: 1020,
                breaks: { create: { startMinute: 720, endMinute: 780 } },
              },
            },
          },
          update: {},
        });
      }
      // Chỉ gán khi tạo dịch vụ mẫu lần đầu để seed lại không phục hồi phân công admin đã bỏ.
      const id = 'bedc0c0a-d5a3-483a-adcb-772ffc926c88';
      const inserted = await tx.service.createMany({
        data: [
          {
            id,
            name: 'Cắt và tạo kiểu',
            description: 'Cắt tóc và tạo kiểu tại salon.',
            priceVnd: 150000,
            durationMinutes: 45,
          },
        ],
        skipDuplicates: true,
      });
      if (inserted.count)
        await tx.staffService.create({
          data: { staffId: user.id, serviceId: id },
        });
    });
    console.log('Đã chuẩn bị danh mục và tài khoản demo.');
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
