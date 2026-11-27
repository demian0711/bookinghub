import { PrismaService } from './prisma/prisma.service';
import { hashPassword } from './auth/password';
import { Prisma } from './generated/prisma/client';
import { Role } from './generated/prisma/enums';
import { readEnvironment } from './environment';

class SeedInputError extends Error {}

async function seed() {
  const { databaseUrl } = readEnvironment();
  const url = new URL(databaseUrl);
  if (
    process.env.NODE_ENV !== 'development' ||
    process.env.ALLOW_DEMO_SEED !== '1' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  ) {
    throw new SeedInputError(
      'Seed yêu cầu development, PostgreSQL loopback và ALLOW_DEMO_SEED=1.',
    );
  }
  const passwords = await Promise.all(
    Object.values(Role).map(async (role) => {
      const password = process.env[`DEMO_${role}_PASSWORD`];
      if (!password || password.length < 12 || password.length > 128)
        throw new SeedInputError(
          `Mật khẩu demo cho ${role} phải dài 12–128 ký tự.`,
        );
      return [role, await hashPassword(password)] as const;
    }),
  );
  const staff = [
    { email: 'staff@demo.bookinghub.test', displayName: 'BookingHub STAFF' },
    { email: 'staff-mai@demo.bookinghub.test', displayName: 'Mai Nguyễn' },
    { email: 'staff-an@demo.bookinghub.test', displayName: 'An Trần' },
  ];
  const services = [
    {
      id: 'bedc0c0a-d5a3-483a-adcb-772ffc926c88',
      name: 'Cắt và tạo kiểu',
      description: 'Cắt tóc và tạo kiểu tại salon.',
      priceVnd: 150000,
      durationMinutes: 45,
      staff: [0],
    },
    {
      id: 'a34f20c1-9b72-4e51-8d64-8b7b893771a1',
      name: 'Gội và sấy tạo kiểu',
      description: 'Gội sạch và sấy tạo kiểu phù hợp với độ dài tóc.',
      priceVnd: 120000,
      durationMinutes: 35,
      staff: [0, 1, 2],
    },
    {
      id: 'a34f20c1-9b72-4e51-8d64-8b7b893771a2',
      name: 'Dưỡng tóc chuyên sâu',
      description: 'Ủ dưỡng và sấy cho tóc khô hoặc đã qua xử lý hóa chất.',
      priceVnd: 320000,
      durationMinutes: 60,
      staff: [1, 2],
    },
    {
      id: 'a34f20c1-9b72-4e51-8d64-8b7b893771a3',
      name: 'Nhuộm tóc một màu',
      description:
        'Tư vấn màu, nhuộm tóc một màu và sấy. Dịch vụ chưa gồm tẩy tóc.',
      priceVnd: 690000,
      durationMinutes: 120,
      staff: [1],
    },
    {
      id: 'a34f20c1-9b72-4e51-8d64-8b7b893771a4',
      name: 'Uốn tạo sóng',
      description:
        'Tư vấn kiểu sóng, uốn tóc và hướng dẫn cách chăm sóc tại nhà.',
      priceVnd: 790000,
      durationMinutes: 150,
      staff: [2],
    },
  ];
  const accounts = passwords.flatMap<Prisma.UserCreateManyInput>(
    ([role, passwordHash]) =>
      role === 'STAFF'
        ? staff.map((account) => ({ ...account, role, passwordHash }))
        : [
            {
              email: `${role.toLowerCase()}@demo.bookinghub.test`,
              role,
              displayName: `BookingHub ${role}`,
              passwordHash,
            },
          ],
  );
  const db = new PrismaService();
  try {
    await db.$transaction(async (tx) => {
      await tx.user.createMany({ data: accounts, skipDuplicates: true });
      const staffIds: string[] = [];
      for (const { email } of staff) {
        const user = await tx.user.findUniqueOrThrow({
          where: { email },
          select: { id: true, role: true },
        });
        if (user.role !== 'STAFF')
          throw new SeedInputError(
            'Một email demo của nhân viên đã thuộc tài khoản khác vai trò.',
          );
        staffIds.push(user.id);
        await tx.staffProfile.upsert({
          where: { userId: user.id },
          create: { userId: user.id },
          update: {},
        });
        // Thứ đã cấu hình được giữ nguyên, kể cả khi admin đã bỏ hết ca.
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
      }
      // Chỉ gán khi tạo mới dịch vụ để giữ nguyên các phân công admin đã chỉnh.
      for (const { staff: assigned, ...service } of services) {
        const inserted = await tx.service.createMany({
          data: [service],
          skipDuplicates: true,
        });
        if (inserted.count)
          await tx.staffService.createMany({
            data: assigned.map((index) => ({
              staffId: staffIds[index],
              serviceId: service.id,
            })),
          });
      }
    });
    console.log('Đã chuẩn bị danh mục và tài khoản demo.');
  } finally {
    await db.$disconnect();
  }
}
seed().catch((error: unknown) => {
  // In thông báo đã định nghĩa và mã Prisma. Chi tiết lỗi có thể chứa dữ liệu kết nối.
  if (error instanceof SeedInputError)
    console.error(`Seed thất bại. ${error.message}`);
  else if (error instanceof Prisma.PrismaClientKnownRequestError)
    console.error(
      `Seed thất bại khi ghi PostgreSQL (${error.code}). Kiểm tra kết nối và migration.`,
    );
  else
    console.error('Seed thất bại. Kiểm tra cấu hình API và kết nối database.');
  process.exitCode = 1;
});
