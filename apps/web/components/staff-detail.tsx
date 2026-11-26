'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useResource } from '@/lib/use-resource';
import {
  dayText,
  timeText,
  statusNames,
  type Status,
} from '@/lib/appointments';
import { price } from '@/lib/catalog';
import { StaffFeedback } from './staff-gate';
import type { StaffVisit } from './staff-list';
type Detail = StaffVisit & {
  serverNow: string;
  staff?: { user: { displayName: string } };
  events: { status: Status; occurredAt: string; reason: string | null }[];
};
const labels = {
  CONFIRMED: 'Xác nhận lịch',
  CANCELLED: 'Hủy lịch',
  COMPLETED: 'Hoàn thành',
  NO_SHOW: 'Ghi nhận không đến',
};
type Action = keyof typeof labels;
function Actions({
  visit,
  refresh,
  area,
}: {
  area: 'admin' | 'staff';
  visit: Detail;
  refresh: (message: string) => void;
}) {
  // Neo thời gian vào phản hồi backend để đồng hồ máy nhân viên không mở nút quá sớm.
  const [anchor] = useState(() => ({
    server: Date.parse(visit.serverNow),
    local: performance.now(),
  }));
  const [now, setNow] = useState(anchor.server);
  const [action, setAction] = useState<Action>('CONFIRMED'),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    sending = useRef(false);
  const start = Date.parse(visit.startAt),
    end = Date.parse(visit.endAt);
  // Mở thao tác mới đúng mốc kể cả khi nhân viên giữ nguyên màn hình chi tiết.
  useEffect(() => {
    if (visit.status !== 'CONFIRMED') return;
    const boundary = [start, end].find((t) => t > now);
    if (boundary === undefined) return;
    const serverTime = () => anchor.server + performance.now() - anchor.local;
    const timer = window.setTimeout(
      () => setNow(serverTime()),
      Math.min(2147483647, Math.max(1, boundary - serverTime())),
    );
    return () => window.clearTimeout(timer);
  }, [visit.status, start, end, now, anchor]);
  const actions: Action[] = [];
  if (visit.status === 'PENDING') actions.push('CONFIRMED');
  if (visit.status === 'CONFIRMED') {
    if (now >= end) actions.push('COMPLETED');
    if (now >= start) actions.push('NO_SHOW');
  }
  if (visit.status === 'PENDING' || visit.status === 'CONFIRMED')
    actions.push('CANCELLED');
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (
      sending.current ||
      !actions.includes(action) ||
      (action === 'CANCELLED' && !reason.trim())
    )
      return;
    sending.current = true;
    setBusy(true);
    let message: string;
    try {
      const r = await fetch(
        '/api/v1/' + area + '/appointments/' + visit.id + '/status',
        {
          method: 'PATCH',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
            'X-BookingHub-CSRF': '1',
          },
          body: JSON.stringify({
            expectedStatus: visit.status,
            status: action,
            ...(action === 'CANCELLED' ? { reason: reason.trim() } : {}),
          }),
        },
      );
      if (r.ok) message = 'Đã cập nhật lịch hẹn.';
      else if (r.status === 409)
        message =
          'Lịch vừa thay đổi hoặc chưa đến giờ xử lý. Hãy xem lại trạng thái mới.';
      else
        message = 'Chưa thể cập nhật. Hãy kiểm tra lại lịch và quyền thao tác.';
    } catch {
      message = 'Kết nối gián đoạn. Hãy kiểm tra kết quả trước khi thử lại.';
    }
    dialog.current?.close();
    refresh(message);
  }
  if (!actions.length) return null;
  return (
    <>
      <div className="actions">
        {actions.map((key) => (
          <button
            key={key}
            className={key === 'CANCELLED' ? 'secondary' : 'primary'}
            onClick={() => {
              setAction(key);
              setReason('');
              dialog.current?.showModal();
            }}
          >
            {labels[key]}
          </button>
        ))}
      </div>
      <dialog
        ref={dialog}
        aria-labelledby="staff-action"
        className="cancel-dialog"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <form onSubmit={submit}>
          <h2 id="staff-action">{labels[action]}?</h2>
          <p>
            {visit.customer.displayName} · {visit.serviceName} ·{' '}
            {timeText(visit.startAt)}, {dayText(visit.startAt)}
          </p>
          {action === 'CANCELLED' && (
            <label className="field">
              Lý do hủy
              <textarea
                required
                maxLength={500}
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          )}
          <div className="actions">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => dialog.current?.close()}
            >
              Quay lại
            </button>
            <button
              className="primary"
              disabled={busy || (action === 'CANCELLED' && !reason.trim())}
            >
              {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
export function StaffDetail({
  id,
  area = 'staff',
}: {
  id: string;
  area?: 'admin' | 'staff';
}) {
  const { result, retry } = useResource<Detail>(
    '/api/v1/' + area + '/appointments/' + encodeURIComponent(id),
  );
  const [message, setMessage] = useState('');
  const visit = result && 'data' in result ? result.data : undefined;
  return (
    <>
      <h1>
        {area === 'admin'
          ? 'Chi tiết lịch toàn salon'
          : 'Chi tiết lịch được giao'}
      </h1>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {visit ? (
        <article className="detail">
          <h2>{visit.serviceName}</h2>
          <dl>
            {Object.entries({
              ...(visit.staff
                ? { 'Nhân viên': visit.staff.user.displayName }
                : {}),
              Khách: visit.customer.displayName,
              'Trạng thái': statusNames[visit.status],
              'Ngày hẹn': dayText(visit.startAt),
              'Giờ salon':
                timeText(visit.startAt) + '–' + timeText(visit.endAt),
              'Thời lượng': visit.durationMinutes + ' phút',
              'Giá khi đặt': price(visit.priceVnd),
            }).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <h3>Lịch sử</h3>
          <ul>
            {visit.events.map((event) => (
              <li key={event.status}>
                {statusNames[event.status]} · {timeText(event.occurredAt)},{' '}
                {dayText(event.occurredAt)}
                {event.reason && ' · ' + event.reason}
              </li>
            ))}
          </ul>
          <Actions
            area={area}
            visit={visit}
            refresh={(msg) => {
              setMessage(msg);
              retry();
            }}
          />
        </article>
      ) : (
        <StaffFeedback
          retry={retry}
          error={result && 'error' in result ? result.error : undefined}
        />
      )}
    </>
  );
}
