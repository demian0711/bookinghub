import type { ReactNode } from 'react';
import Link from 'next/link';
import { Scissors, UserRound } from 'lucide-react';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/playfair-display';
import './globals.css';
export const metadata = {
  title: { default: 'BookingHub · Salon tóc', template: '%s · BookingHub' },
  description: 'Khám phá dịch vụ và đặt lịch chăm sóc tóc.',
};
function Brand() {
  return (
    <Link href="/" className="brand" aria-label="BookingHub – Trang chủ">
      <Scissors size={24} />
      BookingHub
    </Link>
  );
}
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <a className="skip" href="#content">
          Đến nội dung chính
        </a>
        <header>
          <div className="shell top">
            <Brand />
            <nav aria-label="Điều hướng chính">
              <Link href="/dich-vu">Dịch vụ</Link>
              <Link className="account-link" href="/tai-khoan">
                <UserRound size={17} />
                Tài khoản
              </Link>
            </nav>
          </div>
        </header>
        <main id="content" tabIndex={-1}>
          {children}
        </main>
        <footer>
          <div className="shell foot">
            <Brand />
            <span>Giờ salon · Việt Nam (GMT+7)</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
