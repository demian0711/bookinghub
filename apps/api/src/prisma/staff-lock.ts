import { NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
export async function lockStaff(tx: Prisma.TransactionClient, staffId: string) {
  const rows = await tx.$queryRaw<
    { userId: string }[]
  >`SELECT "userId" FROM "StaffProfile" WHERE "userId"=${staffId}::uuid FOR UPDATE`;
  if (!rows.length) throw new NotFoundException();
}
