'use client';
import Link from 'next/link';
import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useResource } from '@/lib/use-resource';
import { type Service, price } from '@/lib/catalog';
import { type User } from '@/lib/account';
import {
  type Appointment,
  dayText,
  timeText,
  salonDay,
  writeAppointment,
} from '@/lib/appointments';
export interface Draft {
  serviceId: string;
  staffId: string;
  date: string;
  startAt: string;
  staffPage: number;
}
const SubmissionContext = createContext<(busy: boolean) => void>(
  () => undefined,
);
type Staff = { id: string; displayName: string };
function Progress({ retry, error }: { retry: () => void; error?: number }) {
  return error === undefined ? (
    <p role="status">Đang tải…</p>
  ) : (
    <p role="alert">
      Chưa tải được lựa chọn này.{' '}
      <button className="text-link" onClick={retry}>
        Thử lại
      </button>
    </p>
  );
}
export function Booking({ draft }: { draft: Draft }) {
  const [submitting, setSubmitting] = useState(false);
  const service = useResource<Service>(
    '/api/v1/services/' + encodeURIComponent(draft.serviceId),
  );
  return (
    <section className="shell inner booking">
      <Link className="text-link" href="/dich-vu">
        ← Chọn dịch vụ khác
      </Link>
      <h1>Đặt lịch salon</h1>
      {service.result && 'data' in service.result ? (
        <>
          <h2>{service.result.data.name}</h2>
          <p>
            {service.result.data.durationMinutes} phút ·{' '}
            {price(service.result.data.priceVnd)}
          </p>
          <SubmissionContext.Provider value={setSubmitting}>
            <fieldset disabled={submitting} aria-label="Lựa chọn đặt lịch">
              <ChooseStaff service={service.result.data} draft={draft} />
            </fieldset>
          </SubmissionContext.Provider>
        </>
      ) : (
        <Progress error={service.result?.error} retry={service.retry} />
      )}
    </section>
  );
}
function ChooseStaff({ service, draft }: { service: Service; draft: Draft }) {
  const [page, setPage] = useState(draft.staffPage),
    [id, setId] = useState(draft.staffId);
  const { result, retry } = useResource<{ items: Staff[]; hasNext: boolean }>(
    '/api/v1/services/' + service.id + '/staff?pageSize=20&page=' + page,
  );
  const [restoring, restore] = useState(true);
  if (!result || 'error' in result)
    return <Progress retry={retry} error={result?.error} />;
  const staff = result.data.items.find((s) => s.id === id);
  function changePage(n: number) {
    setPage(n);
    setId('');
    restore(false);
  }
  return (
    <>
      <div className="field">
        <label htmlFor="booking-staff">Nhân viên</label>
        <select
          id="booking-staff"
          value={staff?.id ?? ''}
          onChange={(e) => {
            setId(e.target.value);
            restore(false);
          }}
        >
          <option value="">Chọn nhân viên</option>
          {result.data.items.map((s) => (
            <option key={s.id} value={s.id}>
              {s.displayName}
            </option>
          ))}
        </select>
      </div>
      {!result.data.items.length && (
        <p role="status">Chưa có nhân viên nhận dịch vụ này.</p>
      )}
      {id && !staff && (
        <p role="status">
          Nhân viên đã chọn hiện không có trong danh sách này.
        </p>
      )}
      {(page > 1 || result.data.hasNext) && (
        <nav className="actions" aria-label="Danh sách nhân viên">
          <button disabled={page === 1} onClick={() => changePage(page - 1)}>
            Trang trước
          </button>
          <span>{page}</span>
          <button
            disabled={!result.data.hasNext}
            onClick={() => changePage(page + 1)}
          >
            Trang sau
          </button>
        </nav>
      )}
      {staff && (
        <ChooseDay
          key={staff.id}
          service={service}
          staff={staff}
          page={page}
          draft={restoring ? draft : undefined}
        />
      )}
    </>
  );
}
function ChooseDay({
  service,
  staff,
  page,
  draft,
}: {
  service: Service;
  staff: Staff;
  page: number;
  draft?: Draft;
}) {
  const min = salonDay(),
    max = salonDay(29);
  const [date, setDate] = useState(
    draft?.date && draft.date >= min && draft.date <= max ? draft.date : min,
  );
  const [restore, setRestore] = useState(true);
  return (
    <>
      <label className="field">
        Ngày hẹn
        <input
          type="date"
          value={date}
          min={min}
          max={max}
          onChange={(e) => {
            setRestore(false);
            setDate(e.target.value);
          }}
        />
      </label>
      {date >= min && date <= max ? (
        <ChooseSlot
          key={date}
          service={service}
          staff={staff}
          date={date}
          page={page}
          initial={restore && date === draft?.date ? draft.startAt : ''}
        />
      ) : (
        <p role="status">Chọn ngày trong 30 ngày tới theo giờ salon.</p>
      )}
    </>
  );
}
function ChooseSlot({
  service,
  staff,
  date,
  page,
  initial,
}: {
  service: Service;
  staff: Staff;
  date: string;
  page: number;
  initial: string;
}) {
  const lookup = new URLSearchParams({
    serviceId: service.id,
    staffId: staff.id,
    date,
  });
  const slots = useResource<{ slots: { startAt: string; endAt: string }[] }>(
    '/api/v1/availability?' + lookup,
  );
  const session = useResource<User>('/api/v1/auth/me');
  const [selected, select] = useState(initial),
    [review, setReview] = useState(Boolean(initial)),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false);
  const sending = useRef(false);
  const setSubmitting = useContext(SubmissionContext);
  const heading = useRef<HTMLHeadingElement>(null);
  const slot =
    slots.result && 'data' in slots.result
      ? slots.result.data.slots.find((s) => s.startAt === selected)
      : undefined;
  useEffect(() => {
    if (review && slot) heading.current?.focus();
  }, [review, slot]);
  function loginPath() {
    lookup.set('startAt', selected);
    lookup.set('staffPage', String(page));
    return '/dang-nhap?next=' + encodeURIComponent('/dat-lich?' + lookup);
  }
  async function book() {
    if (!slot || sending.current) return;
    sending.current = true;
    setSubmitting(true);
    setBusy(true);
    setMessage('');
    try {
      const r = await writeAppointment('', 'POST', {
        serviceId: service.id,
        staffId: staff.id,
        startAt: slot.startAt,
      });
      if (r.status === 201) {
        const a: Appointment = await r.json();
        window.location.replace('/lich-cua-toi/' + a.id + '?created=1');
        return;
      }
      if (r.status === 401) {
        window.location.assign(loginPath());
        return;
      }
      if (r.status === 409 || r.status === 400 || r.status === 404) {
        select('');
        setReview(false);
        setMessage(
          r.status === 409
            ? 'Giờ này vừa có người đặt. Vui lòng chọn giờ khác.'
            : 'Lựa chọn đã thay đổi. Hãy kiểm tra lại giờ trống.',
        );
        slots.retry();
      } else if (r.status === 403)
        setMessage('Chỉ tài khoản khách hàng có thể đặt lịch.');
      else throw Error();
    } catch {
      setUncertain(true);
      setMessage(
        'Chưa xác định được kết quả. Hãy kiểm tra Lịch của tôi trước khi đặt lại.',
      );
    }
    sending.current = false;
    setSubmitting(false);
    setBusy(false);
  }
  return (
    <div className="booking-step">
      {message && <p role="alert">{message}</p>}
      {uncertain ? (
        <Link className="text-link" href="/lich-cua-toi">
          Lịch của tôi
        </Link>
      ) : !slots.result || 'error' in slots.result ? (
        <Progress error={slots.result?.error} retry={slots.retry} />
      ) : (
        <>
          {selected && !slot && (
            <p role="status">Giờ đã chọn không còn trống. Hãy chọn lại.</p>
          )}
          {review && slot ? (
            <section className="summary">
              <h2 tabIndex={-1} ref={heading}>
                Xác nhận lịch hẹn
              </h2>
              <p>
                {service.name} · {staff.displayName}
              </p>
              <p>
                {dayText(slot.startAt)} · {timeText(slot.startAt)}–
                {timeText(slot.endAt)}
              </p>
              <p>
                {service.durationMinutes} phút · {price(service.priceVnd)}
              </p>
              <div className="actions">
                <button
                  disabled={busy}
                  className="secondary"
                  onClick={() => setReview(false)}
                >
                  Đổi giờ
                </button>
                {!session.result ? (
                  <Progress retry={session.retry} />
                ) : 'error' in session.result ? (
                  session.result.error === 401 ? (
                    <Link className="primary" href={loginPath()}>
                      Đăng nhập để xác nhận
                    </Link>
                  ) : (
                    <Progress
                      retry={session.retry}
                      error={session.result.error}
                    />
                  )
                ) : session.result.data.role === 'CUSTOMER' ? (
                  <button className="primary" onClick={book} disabled={busy}>
                    {busy ? 'Đang đặt…' : 'Xác nhận đặt lịch'}
                  </button>
                ) : (
                  <p>Vui lòng dùng tài khoản khách hàng.</p>
                )}
              </div>
            </section>
          ) : (
            <fieldset>
              <legend>Giờ trống · giờ Việt Nam</legend>
              {slots.result.data.slots.length ? (
                <>
                  <div className="slot-grid">
                    {slots.result.data.slots.map((s) => (
                      <button
                        className="secondary"
                        type="button"
                        key={s.startAt}
                        aria-pressed={selected === s.startAt}
                        onClick={() => select(s.startAt)}
                      >
                        {timeText(s.startAt)}
                      </button>
                    ))}
                  </div>
                  <button
                    className="primary"
                    disabled={!slot}
                    onClick={() => setReview(true)}
                  >
                    Tiếp tục
                  </button>
                </>
              ) : (
                <p role="status">
                  Ngày này đã hết giờ trống. Hãy chọn ngày hoặc nhân viên khác.
                </p>
              )}
            </fieldset>
          )}
        </>
      )}
    </div>
  );
}
