'use client';
import Link from 'next/link';
import { useState, useRef, type ReactNode, type FormEvent } from 'react';
import { useResource } from '@/lib/use-resource';
import {
  dayText,
  timeText,
  statusNames,
  type Status,
} from '@/lib/appointments';
export const base = '/api/v1/admin';
export interface Service {
  id: string;
  name: string;
  description: string;
  priceVnd: number;
  durationMinutes: number;
  active: boolean;
}
export interface Employee {
  id: string;
  displayName: string;
  email: string;
  bio: string;
  active: boolean;
  serviceIds: string[];
}
type Impact = { id: string; startAt: string; endAt: string; status: Status };
export function Loading({
  error,
  retry,
}: {
  error?: number;
  retry: () => void;
}) {
  return error === undefined ? (
    <p role="status">Đang tải…</p>
  ) : (
    <p className="notice" role="alert">
      {error === 403
        ? 'Bạn không có quyền quản trị.'
        : error === 401
          ? 'Phiên đăng nhập đã hết hạn.'
          : error === 400
            ? 'Bộ lọc không hợp lệ. Kiểm tra ngày bắt đầu, ngày kết thúc và giới hạn 90 ngày.'
            : 'Chưa tải được dữ liệu.'}{' '}
      <button onClick={retry}>Thử lại</button>
    </p>
  );
}
export function useChange() {
  const [busy, setBusy] = useState(false),
    lock = useRef(false),
    [message, setMessage] = useState(''),
    [affected, setAffected] = useState<Impact[]>([]);
  async function save(
    path: string,
    method: string,
    body: object | undefined,
    question: string,
  ) {
    if (lock.current || !window.confirm(question)) return false;
    lock.current = true;
    setBusy(true);
    setMessage('');
    setAffected([]);
    try {
      const r = await fetch(base + path, {
        method,
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'X-BookingHub-CSRF': '1',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (r.ok) {
        setMessage('Đã lưu thay đổi.');
        return true;
      }
      const data = await r.json();
      if (data.code === 'SCHEDULE_AFFECTS_APPOINTMENTS') {
        setAffected(data.affectedAppointments);
        setMessage(
          'Không thể lưu vì thay đổi ảnh hưởng các lịch đang giữ chỗ.',
        );
      } else
        setMessage(
          data.code === 'DAY_OFF_ALREADY_EXISTS'
            ? 'Ngày đích đã là ngày nghỉ.'
            : r.status === 409
              ? 'Dữ liệu bị trùng. Hãy kiểm tra lại.'
              : r.status === 403
                ? 'Không có quyền thực hiện.'
                : r.status === 401
                  ? 'Phiên đăng nhập đã hết hạn.'
                  : 'Chưa lưu được. Kiểm tra lại dữ liệu đã nhập.',
        );
      return false;
    } catch {
      setMessage('Kết nối gián đoạn. Kiểm tra dữ liệu trước khi gửi lại.');
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const feedback = (
    <>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {affected.length > 0 && (
        <ul className="appointment-list">
          {affected.map((a) => (
            <li key={a.id}>
              <Link href={'/admin/lich-hen/' + a.id}>
                {dayText(a.startAt)} · {timeText(a.startAt)}–{timeText(a.endAt)}{' '}
                · {statusNames[a.status]} · Xử lý lịch →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
  return { save, busy, feedback };
}
export function Directory<T extends { id: string }>({
  path,
  label,
  children,
}: {
  path: 'staff' | 'services';
  label: string;
  children: (rows: T[], reload: () => void) => ReactNode;
}) {
  const [page, setPage] = useState(1),
    [q, setQ] = useState('');
  const { result, retry } = useResource<{ items: T[]; hasNext: boolean }>(
    base +
      '/' +
      path +
      '?' +
      new URLSearchParams({ page: String(page), pageSize: '10', q }),
  );
  function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setQ(String(new FormData(e.currentTarget).get('q') ?? '').trim());
    setPage(1);
  }
  return (
    <section>
      <form className="actions" onSubmit={search}>
        <label className="field">
          Tìm {label}
          <input name="q" type="search" maxLength={120} />
        </label>
        <button className="secondary">Tìm</button>
      </form>
      {!result || 'error' in result ? (
        <Loading error={result?.error} retry={retry} />
      ) : (
        <>
          {!result.data.items.length && (
            <p className="notice">Không có kết quả phù hợp.</p>
          )}
          {children(result.data.items, retry)}
          {(page > 1 || result.data.hasNext) && (
            <nav className="actions" aria-label={'Phân trang ' + label}>
              <button
                className="secondary"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Trang trước
              </button>
              Trang {page}
              <button
                className="secondary"
                disabled={!result.data.hasNext}
                onClick={() => setPage(page + 1)}
              >
                Trang sau
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
