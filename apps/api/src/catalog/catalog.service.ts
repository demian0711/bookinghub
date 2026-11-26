import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword } from '../auth/password';
import {
  ServiceDto,
  EditServiceDto,
  CreateStaffDto,
  EditStaffDto,
  ServiceQuery,
  StaffQuery,
} from './catalog.dto';

import { lockStaff } from '../prisma/staff-lock';
const publicService = {
  id: true,
  name: true,
  description: true,
  priceVnd: true,
  durationMinutes: true,
} as const;
const adminStaff = {
  userId: true,
  bio: true,
  user: { select: { displayName: true, active: true, email: true } },
  assignments: { select: { serviceId: true }, orderBy: { serviceId: 'asc' } },
} as const;

function staffView(
  row: Prisma.StaffProfileGetPayload<{ select: typeof adminStaff }>,
) {
  return {
    id: row.userId,
    bio: row.bio,
    ...row.user,
    serviceIds: row.assignments.map((a) => a.serviceId),
  };
}
function paging(query: ServiceQuery | StaffQuery) {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize + 1 };
}
function page<T>(rows: T[], { page, pageSize }: ServiceQuery | StaffQuery) {
  return {
    items: rows.slice(0, pageSize),
    page,
    pageSize,
    hasNext: rows.length > pageSize,
  };
}
function search(value = '') {
  // contains dùng LIKE trong PostgreSQL; coi cả % và _ người dùng nhập là ký tự thường.
  return {
    contains: value.replace(/[\\%_]/g, '\\$&'),
    mode: 'insensitive' as const,
  };
}
function catalogError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') throw new NotFoundException();
    if (error.code === 'P2002') throw new ConflictException();
  }
  throw error;
}

@Injectable()
export class CatalogService {
  constructor(private readonly db: PrismaService) {}
  async services(query: ServiceQuery, admin = false) {
    const rows = await this.db.service.findMany({
      where: { active: admin ? undefined : true, name: search(query.q) },
      select: { ...publicService, active: admin },
      orderBy: [{ [query.sort]: query.order }, { id: 'asc' }],
      ...paging(query),
    });
    return page(rows, query);
  }
  async detail(id: string) {
    const row = await this.db.service.findFirst({
      where: { id, active: true },
      select: publicService,
    });
    if (!row) throw new NotFoundException();
    return row;
  }
  async staffForService(id: string, query: StaffQuery) {
    // Đọc từ dịch vụ active trong cùng snapshot với danh sách phân công, kể cả khi admin đang sửa.
    const result = await this.db.$transaction(
      async (tx) => {
        const service = await tx.service.findFirst({
          where: { id, active: true },
          select: { id: true },
        });
        if (!service) throw new NotFoundException();
        return tx.staffProfile.findMany({
          where: {
            assignments: { some: { serviceId: id } },
            user: { active: true, displayName: search(query.q) },
          },
          select: {
            userId: true,
            bio: true,
            user: { select: { displayName: true } },
          },
          orderBy: [{ user: { displayName: query.order } }, { userId: 'asc' }],
          ...paging(query),
        });
      },
      { isolationLevel: 'RepeatableRead' },
    );
    return page(
      result.map((row) => ({
        id: row.userId,
        bio: row.bio,
        displayName: row.user.displayName,
      })),
      query,
    );
  }
  createService(dto: ServiceDto) {
    return this.db.service.create({ data: dto });
  }
  updateService(id: string, dto: EditServiceDto) {
    if (Object.values(dto).every((value) => value === undefined))
      throw new BadRequestException();
    return this.db.service
      .update({ where: { id }, data: dto })
      .catch(catalogError);
  }
  async staff(query: StaffQuery) {
    const rows = await this.db.staffProfile.findMany({
      where: { user: { displayName: search(query.q) } },
      select: adminStaff,
      orderBy: [{ user: { displayName: query.order } }, { userId: 'asc' }],
      ...paging(query),
    });
    return page(rows.map(staffView), query);
  }
  async createStaff({ email, displayName, password, bio }: CreateStaffDto) {
    // Nested write tạo tài khoản và hồ sơ cùng giao dịch, mật khẩu chỉ đi qua hàm băm M2.
    const passwordHash = await hashPassword(password);
    const row = await this.db.staffProfile
      .create({
        data: {
          bio,
          user: { create: { email, displayName, passwordHash, role: 'STAFF' } },
        },
        select: adminStaff,
      })
      .catch(catalogError);
    return staffView(row);
  }
  async updateStaff(id: string, dto: EditStaffDto) {
    if (Object.values(dto).every((value) => value === undefined))
      throw new BadRequestException();
    const row = await this.db.$transaction(async (tx) => {
      await lockStaff(tx, id);
      return tx.staffProfile
        .update({
          where: { userId: id },
          data: {
            bio: dto.bio,
            user: {
              update: { displayName: dto.displayName, active: dto.active },
            },
          },
          select: adminStaff,
        })
        .catch(catalogError);
    });
    return staffView(row);
  }
  async setServices(id: string, serviceIds: string[]) {
    return this.db.$transaction(async (tx) => {
      // Khóa hồ sơ để hai lần thay thế đồng thời không trộn hai tập phân công.
      await lockStaff(tx, id);
      if (
        (await tx.service.count({ where: { id: { in: serviceIds } } })) !==
        serviceIds.length
      )
        throw new NotFoundException();
      await tx.staffService.deleteMany({ where: { staffId: id } });
      if (serviceIds.length)
        await tx.staffService.createMany({
          data: serviceIds.map((serviceId) => ({ staffId: id, serviceId })),
        });
      return staffView(
        await tx.staffProfile.findUniqueOrThrow({
          where: { userId: id },
          select: adminStaff,
        }),
      );
    });
  }
}
