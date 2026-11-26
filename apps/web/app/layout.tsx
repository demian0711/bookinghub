import type { ReactNode } from 'react';
import './globals.css';
export const metadata = {
  title: 'BookingHub',
  description: 'Đặt lịch salon tóc',
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
