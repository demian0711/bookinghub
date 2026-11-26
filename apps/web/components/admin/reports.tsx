'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { base, Loading } from './common';
import { useResource } from '@/lib/use-resource';
import {
  salonDay,
  dayText,
  timeText,
  statusNames,
  type Status,
} from '@/lib/appointments';
import { price } from '@/lib/catalog';
type Report = {
  total: number;
  counts: Record<Status, number>;
  completedValue: number;
  cancellationRate: number | null;
  popular: { id: string; name: string; count: number }[];
};
type Row = {
  id: string;
  serviceName: string;
  startAt: string;
  status: Status;
  priceVnd: number;
  customer: { displayName: string };
  staff: { user: { displayName: string } };
};
type Filters = { from: string; to: string; status: string; serviceId: string };
const percent = new Intl.NumberFormat('vi-VN', {
  style: 'percent',
  maximumFractionDigits: 1,
});
export function Reports({
  dashboard,
  initial,
}: {
  dashboard?: boolean;
  initial?: Partial<Filters>;
}) {
  const [filters, setFilters] = useState<Filters>(() => ({
    from: initial?.from ?? salonDay(-6),
    to: initial?.to ?? salonDay(),
    status: initial?.status ?? '',
    serviceId: initial?.serviceId ?? '',
  }));
  const [page, setPage] = useState(1);
  const { from, to, status, serviceId } = filters;
  const query = new URLSearchParams({ from, to });
  if (!dashboard) {
    query.set('page', String(page));
    query.set('pageSize', '10');
    if (status) query.set('status', status);
    if (serviceId) query.set('serviceId', serviceId);
  }
  const { result, retry } = useResource<
    Report | { items: Row[]; total: number }
  >(base + (dashboard ? '/dashboard?' : '/appointments?') + query);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setFilters({
      from: String(data.get('from')),
      to: String(data.get('to')),
      status: String(data.get('status') ?? ''),
      serviceId,
    });
    setPage(1);
  }
  function listLink(extra: Record<string, string> = {}) {
    return '/admin/lich-hen?' + new URLSearchParams({ from, to, ...extra });
  }
  return (
    <>
      <h1>{dashboard ? 'Tổng quan salon' : 'Lịch toàn salon'}</h1>
      <p>
        Khoảng ngày dựa trên giờ bắt đầu lịch hẹn tại Việt Nam, gồm cả ngày đầu
        và cuối. Tối đa 90 ngày.
      </p>
      <form className="staff-filters" onSubmit={submit}>
        <label className="field">
          Từ ngày
          <input name="from" type="date" required defaultValue={from} />
        </label>
        <label className="field">
          Đến ngày
          <input name="to" type="date" required defaultValue={to} />
        </label>
        {!dashboard && (
          <div className="field">
            <label htmlFor="report-status">Trạng thái</label>
            <select id="report-status" name="status" defaultValue={status}>
              <option value="">Tất cả trạng thái</option>
              {Object.entries(statusNames).map(([key, label]) => (
                <option value={key} key={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        )}
        <button className="primary">Áp dụng</button>
      </form>
      {serviceId && (
        <p>
          <Link className="text-link" href={listLink({ status })}>
            Bỏ lọc dịch vụ
          </Link>
        </p>
      )}
      {!result || 'error' in result ? (
        <Loading error={result?.error} retry={retry} />
      ) : 'counts' in result.data ? (
        <>
          <dl className="metric-grid">
            <div>
              <dt>Tổng số lịch</dt>
              <dd>{result.data.total}</dd>
            </div>
            <div>
              <dt>Giá trị dịch vụ hoàn thành</dt>
              <dd>{price(result.data.completedValue)}</dd>
              <small>Tổng giá tại lúc đặt của lịch đã hoàn thành.</small>
            </div>
            <div>
              <dt>Tỷ lệ hủy</dt>
              <dd>
                {result.data.cancellationRate === null
                  ? '—'
                  : percent.format(result.data.cancellationRate)}
              </dd>
              <small>
                Số lịch đã hủy chia tổng số lịch. Dấu gạch khi chưa có lịch.
              </small>
            </div>
          </dl>
          <Link className="text-link" href={listLink()}>
            Đối chiếu toàn bộ lịch →
          </Link>
          <h2>Số lịch theo trạng thái hiện tại</h2>
          <ul className="appointment-list">
            {Object.entries(statusNames).map(([key, label]) => (
              <li key={key}>
                <Link href={listLink({ status: key })}>
                  {label} ·{' '}
                  {'counts' in result.data && result.data.counts[key as Status]}
                </Link>
              </li>
            ))}
          </ul>
          <h2>Dịch vụ phổ biến</h2>
          <p>Tối đa 10 dịch vụ, xếp theo số lịch đã hoàn thành.</p>
          {result.data.popular.length ? (
            <ul className="appointment-list">
              {result.data.popular.map((s) => (
                <li key={s.id}>
                  <Link
                    href={listLink({ status: 'COMPLETED', serviceId: s.id })}
                  >
                    {s.name} · {s.count} lịch
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="notice">Chưa có lịch hoàn thành trong khoảng này.</p>
          )}
        </>
      ) : (
        <>
          <p role="status">{result.data.total} lịch phù hợp</p>
          {result.data.items.length ? (
            <ul className="appointment-list">
              {result.data.items.map((a) => (
                <li key={a.id}>
                  <Link href={'/admin/lich-hen/' + a.id}>
                    <strong>{a.serviceName}</strong>
                    <span>{statusNames[a.status]}</span>
                    <p>
                      {dayText(a.startAt)} · {timeText(a.startAt)} ·{' '}
                      {price(a.priceVnd)}
                    </p>
                    <p>
                      {a.customer.displayName} · {a.staff.user.displayName}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="notice">Không có lịch trong phạm vi đã chọn.</p>
          )}
          {(page > 1 || result.data.total > 10) && (
            <nav className="actions" aria-label="Phân trang lịch">
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
                disabled={page * 10 >= result.data.total || page === 1000}
                onClick={() => setPage(page + 1)}
              >
                Trang sau
              </button>
            </nav>
          )}
        </>
      )}
    </>
  );
}
