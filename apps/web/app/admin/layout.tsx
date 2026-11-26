import Link from 'next/link';
import { StaffGate } from '@/components/staff-gate';
import type { ReactNode } from 'react';
export const metadata = { title: 'Quản trị salon' };
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <StaffGate admin>
      <nav className="admin-nav" aria-label="Quản trị salon">
        {[
          ['/admin', 'Tổng quan'],
          ['/admin/dich-vu', 'Dịch vụ'],
          ['/admin/nhan-vien', 'Nhân viên'],
          ['/admin/ca-lam', 'Ca làm'],
          ['/admin/lich-hen', 'Lịch hẹn'],
        ].map(([url, label]) => (
          <Link href={url} key={url}>
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </StaffGate>
  );
}
