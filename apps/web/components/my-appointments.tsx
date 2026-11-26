'use client';
import Link from 'next/link';
import { useRef, useEffect, useState } from 'react';
import { useResource } from '@/lib/use-resource';
import { type User } from '@/lib/account';
import {
  type Appointment,
  statusNames,
  type Status,
  dayText,
  timeText,
  writeAppointment,
} from '@/lib/appointments';
import { price } from '@/lib/catalog';
type Event = { status: Status; occurredAt: string; reason: string | null };
type Detail = Appointment & { events: Event[] };
function Feedback({ error, retry }: { error?: number; retry: () => void }) {
  if (error === undefined)
    return (
      <p role="status" className="notice">
        Đang tải…
      </p>
    );
  if (error === 404 || error === 400)
    return <p className="notice">Không tìm thấy lịch hẹn này.</p>;
  if (error === 401)
    return (
      <a
        className="primary"
        href={'/dang-nhap?next=' + encodeURIComponent(window.location.pathname)}
      >
        Đăng nhập để xem lịch
      </a>
    );
  return (
    <p role="alert" className="notice">
      Chưa tải được dữ liệu. <button onClick={retry}>Thử lại</button>
    </p>
  );
}
export function MyAppointments({
  id,
  created = false,
}: {
  id?: string;
  created?: boolean;
}) {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const refresh = () => setVersion((n) => n + 1);
    const channel = new BroadcastChannel('bookinghub-session');
    channel.onmessage = refresh;
    function visible() {
      if (document.visibilityState === 'visible') refresh();
    }
    function restored(e: PageTransitionEvent) {
      if (e.persisted) refresh();
    }
    window.addEventListener('pageshow', restored);
    document.addEventListener('visibilitychange', visible);
    return () => {
      channel.close();
      window.removeEventListener('pageshow', restored);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);
  return (
    <section className="shell inner booking">
      {id && (
        <Link className="text-link" href="/lich-cua-toi">
          ← Lịch của tôi
        </Link>
      )}
      <h1>{id ? 'Chi tiết lịch hẹn' : 'Lịch của tôi'}</h1>
      <CustomerScope key={version} id={id} created={created} />
    </section>
  );
}
function CustomerScope({ id, created }: { id?: string; created: boolean }) {
  const me = useResource<User>('/api/v1/auth/me');
  if (!me.result || 'error' in me.result)
    return <Feedback error={me.result?.error} retry={me.retry} />;
  if (me.result.data.role !== 'CUSTOMER')
    return <p>Trang này dành cho tài khoản khách hàng.</p>;
  return id ? (
    <AppointmentDetail id={id} created={created} />
  ) : (
    <AppointmentList />
  );
}
function AppointmentList() {
  const [page, setPage] = useState(1),
    [date, setDate] = useState(''),
    [status, setStatus] = useState('');
  const query = new URLSearchParams({
    pageSize: '5',
    page: String(page),
    order: 'desc',
  });
  if (date) query.set('date', date);
  if (status) query.set('status', status);
  const { result, retry } = useResource<{
    items: Appointment[];
    total: number;
  }>('/api/v1/appointments?' + query);
  return (
    <>
      <div className="filters">
        <label className="field">
          Ngày hẹn
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <div className="field">
          <label htmlFor="status-filter">Trạng thái</label>
          <select
            id="status-filter"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(statusNames).map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {!result || 'error' in result ? (
        <Feedback error={result?.error} retry={retry} />
      ) : (
        <>
          {result.data.items.length === 0 ? (
            <p role="status" className="notice">
              Chưa có lịch phù hợp.{' '}
              <Link href="/dich-vu" className="text-link">
                Chọn dịch vụ
              </Link>
            </p>
          ) : (
            <ul className="appointment-list">
              {result.data.items.map((a) => (
                <li key={a.id}>
                  <Link href={'/lich-cua-toi/' + a.id}>
                    <strong>{a.serviceName}</strong>
                    <span>{statusNames[a.status]}</span>
                    <p>
                      {dayText(a.startAt)} · {timeText(a.startAt)}
                    </p>
                    <p>
                      {price(a.priceVnd)} · {a.durationMinutes} phút
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {(page > 1 || result.data.total > 5) && (
            <nav aria-label="Phân trang lịch hẹn" className="actions">
              <button
                className="secondary"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Trang trước
              </button>
              <span>Trang {page}</span>
              <button
                className="secondary"
                disabled={page * 5 >= result.data.total}
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
function AppointmentDetail({ id, created }: { id: string; created: boolean }) {
  const { result, retry } = useResource<Detail>(
    '/api/v1/appointments/' + encodeURIComponent(id),
  );
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    sending = useRef(false);
  async function cancel(a: Detail) {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      const r = await writeAppointment('/' + id + '/status', 'PATCH', {
        expectedStatus: a.status,
        status: 'CANCELLED',
      });
      if (r.ok) setMessage('Đã hủy lịch hẹn.');
      else if (r.status === 409)
        setMessage(
          'Chưa thể hủy. Lịch đã đổi trạng thái hoặc còn dưới 2 giờ trước giờ hẹn.',
        );
      else setMessage('Chưa thể hủy lịch. Vui lòng kiểm tra lại.');
    } catch {
      setMessage('Kết nối bị gián đoạn. Hãy kiểm tra trạng thái lịch.');
    } finally {
      dialog.current?.close();
      sending.current = false;
      setBusy(false);
      retry();
    }
  }
  if (!result || 'error' in result)
    return <Feedback retry={retry} error={result?.error} />;
  const a = result.data,
    held = a.status === 'PENDING' || a.status === 'CONFIRMED';
  return (
    <>
      {created && held && (
        <p role="status" className="success">
          Đặt lịch thành công
        </p>
      )}
      <article className="detail">
        <h2>{a.serviceName}</h2>
        <dl>
          {Object.entries({
            'Trạng thái': statusNames[a.status],
            'Ngày hẹn': dayText(a.startAt),
            'Giờ salon': timeText(a.startAt) + '–' + timeText(a.endAt),
            'Giá khi đặt': price(a.priceVnd),
            'Thời lượng khi đặt': a.durationMinutes + ' phút',
          }).map(([key, val]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{val}</dd>
            </div>
          ))}
        </dl>
        <h3>Lịch sử</h3>
        <ul>
          {a.events.map((e) => (
            <li key={e.status}>
              {statusNames[e.status]} · {dayText(e.occurredAt)},{' '}
              {timeText(e.occurredAt)}
              {e.reason ? ' · ' + e.reason : ''}
            </li>
          ))}
        </ul>
        {message && <p role="status">{message}</p>}
        {held && (
          <>
            <p className="intro">
              Bạn có thể hủy khi còn ít nhất 2 giờ trước giờ hẹn.
            </p>
            <button
              className="secondary"
              onClick={() => dialog.current?.showModal()}
            >
              Hủy lịch
            </button>
            <dialog
              ref={dialog}
              aria-labelledby="cancel-title"
              className="cancel-dialog"
              onCancel={(e) => {
                if (busy) e.preventDefault();
              }}
            >
              <h2 id="cancel-title">Hủy lịch hẹn này?</h2>
              <p>
                {a.serviceName} · {timeText(a.startAt)}, {dayText(a.startAt)}.
                Khi hủy, giờ hẹn sẽ được mở lại.
              </p>
              <div className="actions">
                <button
                  autoFocus
                  disabled={busy}
                  className="secondary"
                  onClick={() => dialog.current?.close()}
                >
                  Giữ lịch
                </button>
                <button
                  disabled={busy}
                  className="primary"
                  onClick={() => cancel(a)}
                >
                  {busy ? 'Đang hủy…' : 'Xác nhận hủy'}
                </button>
              </div>
            </dialog>
          </>
        )}
      </article>
    </>
  );
}
