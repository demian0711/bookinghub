import type { ReactNode } from 'react';
import { StaffGate } from '@/components/staff-gate';
export const metadata = { title: 'Lịch làm việc của tôi' };
export default function Layout({ children }: { children: ReactNode }) {
  return <StaffGate>{children}</StaffGate>;
}
