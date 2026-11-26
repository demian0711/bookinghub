'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { base, Directory, Loading, useChange, type Employee } from './common';
import { useResource } from '@/lib/use-resource';
const weekdays = [
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
  'Chủ nhật',
];
type Hours = { start: string; end: string };
type Shift = Hours & { breaks: Hours[] };
type Schedule = {
  week: { weekday: number; shifts: Shift[] }[];
  daysOff: string[];
};
const hours = () => ({ start: '09:00', end: '17:00' });
export function ScheduleEditor({ id }: { id?: string }) {
  return (
    <>
      <h1>Ca làm và ngày nghỉ</h1>
      {id ? (
        <Editor key={id} id={id} />
      ) : (
        <Directory<Employee> path="staff" label="nhân viên">
          {(rows) => (
            <ul className="appointment-list">
              {rows.map((row) => (
                <li key={row.id}>
                  <Link href={'/admin/ca-lam?staffId=' + row.id}>
                    {row.displayName}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Directory>
      )}
    </>
  );
}
function Editor({ id }: { id: string }) {
  const path = '/staff/' + encodeURIComponent(id) + '/schedule';
  const { result, retry } = useResource<Schedule>(base + path);
  const [weekday, select] = useState(1);
  return (
    <>
      <Link className="text-link" href="/admin/ca-lam">
        ← Chọn nhân viên
      </Link>
      <label className="field">
        Thứ trong tuần
        <select
          value={weekday}
          onChange={(e) => select(Number(e.target.value))}
        >
          {weekdays.map((day, i) => (
            <option key={day} value={i + 1}>
              {day}
            </option>
          ))}
        </select>
      </label>
      {!result || 'error' in result ? (
        <Loading error={result?.error} retry={retry} />
      ) : (
        <>
          <Shifts
            key={weekday}
            path={path + '/week/' + weekday}
            initial={
              result.data.week.find((x) => x.weekday === weekday)?.shifts ?? []
            }
          />
          <DaysOff
            path={path + '/days-off'}
            dates={result.data.daysOff}
            reload={retry}
          />
        </>
      )}
    </>
  );
}
function HoursFields({
  range,
  change,
}: {
  range: Hours;
  change: (field: keyof Hours, value: string) => void;
}) {
  return (
    <div className="admin-hours">
      {(['start', 'end'] as const).map((field) => (
        <label key={field}>
          {field === 'start' ? 'Bắt đầu' : 'Kết thúc'}
          <input
            required
            pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]|24:00"
            placeholder="HH:mm"
            value={range[field]}
            onChange={(e) => change(field, e.target.value)}
          />
        </label>
      ))}
    </div>
  );
}
function Shifts({ path, initial }: { path: string; initial: Shift[] }) {
  const [shifts, set] = useState(initial);
  const { save, busy, feedback } = useChange();
  function edit(index: number, shift: Shift) {
    set((rows) => rows.map((row, i) => (i === index ? shift : row)));
  }
  return (
    <>
      <h2>Ca làm</h2>
      <p>Nhập giờ Việt Nam dạng HH:mm. Có thể dùng 24:00 làm giờ kết thúc.</p>
      <form
        className="admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save(
            path,
            'PUT',
            { shifts },
            'Lưu ca làm và khoảng nghỉ của thứ này?',
          );
        }}
      >
        <fieldset disabled={busy}>
          {!shifts.length && <p>Không có ca trong ngày này.</p>}
          {shifts.map((s, i) => (
            <fieldset className="notice" key={i}>
              <legend>Ca {i + 1}</legend>
              <HoursFields
                range={s}
                change={(key, val) => edit(i, { ...s, [key]: val })}
              />
              {s.breaks.map((b, j) => (
                <fieldset key={j}>
                  <legend>Khoảng nghỉ {j + 1}</legend>
                  <HoursFields
                    range={b}
                    change={(key, val) =>
                      edit(i, {
                        ...s,
                        breaks: s.breaks.map((item, k) =>
                          k === j ? { ...item, [key]: val } : item,
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      edit(i, {
                        ...s,
                        breaks: s.breaks.filter((_, k) => k !== j),
                      })
                    }
                  >
                    Bỏ khoảng nghỉ
                  </button>
                </fieldset>
              ))}
              <div className="actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    edit(i, {
                      ...s,
                      breaks: [...s.breaks, { start: '12:00', end: '13:00' }],
                    })
                  }
                >
                  Thêm khoảng nghỉ
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => set(shifts.filter((_, j) => i !== j))}
                >
                  Bỏ ca
                </button>
              </div>
            </fieldset>
          ))}
          <div className="actions">
            <button
              type="button"
              className="secondary"
              onClick={() => set([...shifts, { ...hours(), breaks: [] }])}
            >
              Thêm ca
            </button>
            <button className="primary">Lưu ca làm</button>
          </div>
        </fieldset>
      </form>
      {feedback}
    </>
  );
}
function DaysOff({
  path,
  dates,
  reload,
}: {
  path: string;
  dates: string[];
  reload: () => void;
}) {
  const { save, busy, feedback } = useChange();
  async function submit(e: FormEvent<HTMLFormElement>, old?: string) {
    e.preventDefault();
    const date = String(new FormData(e.currentTarget).get('date'));
    if (
      await save(
        path + '/' + (old ?? date),
        old ? 'PATCH' : 'PUT',
        old ? { date } : undefined,
        old ? 'Chuyển ngày nghỉ?' : 'Thêm ngày nghỉ?',
      )
    )
      reload();
  }
  return (
    <section>
      <h2>Ngày nghỉ</h2>
      {!dates.length && <p>Chưa có ngày nghỉ.</p>}
      <form className="admin-form" onSubmit={(e) => submit(e)}>
        <label>
          Ngày nghỉ mới
          <input required name="date" type="date" />
        </label>
        <button disabled={busy} className="primary">
          Thêm ngày nghỉ
        </button>
      </form>
      {dates.map((date) => (
        <form
          className="admin-form"
          key={date}
          onSubmit={(e) => submit(e, date)}
        >
          <label>
            Ngày nghỉ {date}
            <input required type="date" name="date" defaultValue={date} />
          </label>
          <div className="actions">
            <button disabled={busy} className="secondary">
              Chuyển ngày nghỉ
            </button>
            <button
              disabled={busy}
              type="button"
              className="secondary"
              onClick={async () => {
                if (
                  await save(
                    path + '/' + date,
                    'DELETE',
                    undefined,
                    'Bỏ ngày nghỉ và mở lại ca định kỳ?',
                  )
                )
                  reload();
              }}
            >
              Bỏ ngày nghỉ
            </button>
          </div>
        </form>
      ))}
      {feedback}
    </section>
  );
}
