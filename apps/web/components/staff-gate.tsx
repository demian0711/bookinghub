'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import type { User } from '@/lib/account';
import { useResource } from '@/lib/use-resource';
export function StaffFeedback({
  error,
  retry,
  admin = false,
}: {
  error?: number;
  admin?: boolean;
  retry: () => void;
}) {
  if (error === undefined)
    return (
      <p role="status" className="notice">
        Đang tải…
      </p>
    );
  if (error === 401)
    return (
      <p className="notice">
        {admin
          ? 'Vui lòng đăng nhập để quản trị salon.'
          : 'Vui lòng đăng nhập để xem lịch làm việc.'}{' '}
        <Link
          className="text-link"
          href={
            '/dang-nhap?next=' +
            encodeURIComponent(
              window.location.pathname + window.location.search,
            )
          }
        >
          Đăng nhập
        </Link>
      </p>
    );
  if (error === 403)
    return (
      <p className="notice">
        Khu vực này chỉ dành cho nhân viên.{' '}
        <Link href="/tai-khoan" className="text-link">
          Về tài khoản
        </Link>
      </p>
    );
  if (error === 404)
    return (
      <p role="status" className="notice">
        Không tìm thấy lịch hẹn được giao.
      </p>
    );
  return (
    <p className="notice" role="alert">
      {admin
        ? 'Chưa xác minh được phiên quản trị.'
        : 'Chưa tải được lịch làm việc.'}{' '}
      <button onClick={retry}>Thử lại</button>
    </p>
  );
}
function Session({ children, admin }: { children: ReactNode; admin: boolean }) {
  const { result, retry } = useResource<User>('/api/v1/auth/me');
  if (!result || 'error' in result)
    return <StaffFeedback admin={admin} retry={retry} error={result?.error} />;
  if (admin && result.data.role !== 'ADMIN')
    return (
      <p className="notice">
        Khu vực này chỉ dành cho quản trị viên.{' '}
        <Link href="/tai-khoan">Về tài khoản</Link>
      </p>
    );
  if (admin) return <>{children}</>;
  if (result.data.role !== 'STAFF')
    return <StaffFeedback error={403} retry={retry} />;
  return (
    <>
      <nav className="actions" aria-label="Điều hướng nhân viên">
        <Link className="text-link" href="/staff">
          Lịch được giao
        </Link>
        <Link className="text-link" href="/tai-khoan">
          Tài khoản
        </Link>
      </nav>
      {children}
    </>
  );
}
export function StaffGate({
  children,
  admin = false,
}: {
  children: ReactNode;
  admin?: boolean;
}) {
  const path = usePathname();
  const [version, setVersion] = useState(0);
  // Cookie chỉ gửi tới /api/v1. Layout chỉ mở nội dung sau khi xác minh phiên qua cùng origin.
  useEffect(() => {
    const changed = () => setVersion((v) => v + 1);
    const channel = new BroadcastChannel('bookinghub-session');
    channel.onmessage = changed;
    function visible() {
      if (document.visibilityState === 'visible') changed();
    }
    function restored(e: PageTransitionEvent) {
      if (e.persisted) changed();
    }
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('pageshow', restored);
    return () => {
      channel.close();
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('pageshow', restored);
    };
  }, []);
  return (
    <section className="shell inner booking staff-area">
      <Session admin={admin} key={path + ':' + version}>
        {children}
      </Session>
    </section>
  );
}
