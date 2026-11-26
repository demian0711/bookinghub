'use client';
import Link from 'next/link';
import { useResource } from '@/lib/use-resource';
import {
  type Appointment,
  salonDay,
  timeText,
  statusNames,
} from '@/lib/appointments';
import { StaffFeedback } from './staff-gate';
export type StaffVisit = Appointment & { customer: { displayName: string } };
export function StaffList({
  date = salonDay(),
  status,
  page,
}: {
  date?: string;
  status: string;
  page: number;
}) {
  const query = new URLSearchParams({
    date,
    page: String(page),
    pageSize: '10',
  });
  if (status) query.set('status', status);
  const { result, retry } = useResource<{ items: StaffVisit[]; total: number }>(
    '/api/v1/staff/appointments?' + query,
  );
  function pageLink(n: number) {
    const next = new URLSearchParams({ date, page: String(n) });
    if (status) next.set('status', status);
    return '/staff?' + next;
  }
  return (
    <>
      <h1>Lịch làm việc của tôi</h1>
      <form action="/staff" className="staff-filters">
        <label className="field">
          Ngày tại salon
          <input type="date" required name="date" defaultValue={date} />
        </label>
        <div className="field">
          <label htmlFor="staff-status">Trạng thái</label>
          <select id="staff-status" name="status" defaultValue={status}>
            <option value="">Tất cả trạng thái</option>
            {Object.entries(statusNames).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button className="primary">Xem lịch</button>
      </form>
      {!result || 'error' in result ? (
        <StaffFeedback retry={retry} error={result?.error} />
      ) : (
        <>
          {result.data.items.length ? (
            <ul className="appointment-list">
              {result.data.items.map((a) => (
                <li key={a.id}>
                  <Link href={'/staff/' + a.id}>
                    <strong>
                      {timeText(a.startAt)}–{timeText(a.endAt)} ·{' '}
                      {a.serviceName}
                    </strong>
                    <span>{statusNames[a.status]}</span>
                    <p>Khách: {a.customer.displayName}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p role="status" className="notice">
              Không có lịch được giao phù hợp với bộ lọc.
            </p>
          )}
          {(page > 1 || result.data.total > 10) && (
            <nav className="actions" aria-label="Phân trang">
              {page > 1 && (
                <Link className="secondary" href={pageLink(page - 1)}>
                  Trang trước
                </Link>
              )}
              <span>Trang {page}</span>
              {page * 10 < result.data.total && page < 1000 && (
                <Link className="secondary" href={pageLink(page + 1)}>
                  Trang sau
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </>
  );
}
