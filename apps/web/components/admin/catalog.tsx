'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Directory, useChange, type Service, type Employee } from './common';
import { price } from '@/lib/catalog';
function ServiceForm({ row, done }: { row?: Service; done: () => void }) {
  const { save, busy, feedback } = useChange();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      name: String(f.get('name')).trim(),
      description: String(f.get('description')).trim(),
      priceVnd: Number(f.get('priceVnd')),
      durationMinutes: Number(f.get('durationMinutes')),
      ...(row ? { active: f.has('active') } : {}),
    };
    if (
      await save(
        '/services' + (row ? '/' + row.id : ''),
        row ? 'PATCH' : 'POST',
        body,
        row
          ? 'Lưu thay đổi dịch vụ? Lịch đã đặt giữ nguyên giá và thời lượng.'
          : 'Tạo dịch vụ này?',
      )
    )
      done();
  }
  return (
    <>
      <form method="post" className="admin-form" onSubmit={submit}>
        <label>
          Tên dịch vụ
          <input
            required
            name="name"
            maxLength={120}
            defaultValue={row?.name}
          />
        </label>
        <label>
          Mô tả
          <textarea
            name="description"
            maxLength={1000}
            defaultValue={row?.description}
          />
        </label>
        <label>
          Giá (VND)
          <input
            required
            type="number"
            name="priceVnd"
            min={0}
            max={10000000}
            defaultValue={row?.priceVnd}
          />
        </label>
        <label>
          Thời lượng (phút)
          <input
            required
            type="number"
            name="durationMinutes"
            min={1}
            max={480}
            defaultValue={row?.durationMinutes}
          />
        </label>
        {row && (
          <label>
            <input name="active" type="checkbox" defaultChecked={row.active} />{' '}
            Đang hoạt động
          </label>
        )}
        <button disabled={busy} className="primary">
          {row ? 'Lưu dịch vụ' : 'Tạo dịch vụ'}
        </button>
      </form>
      {feedback}
    </>
  );
}
export function Services() {
  const [version, update] = useState(0);
  return (
    <>
      <h1>Dịch vụ</h1>
      <details key={version}>
        <summary>Thêm dịch vụ</summary>
        <ServiceForm done={() => update((n) => n + 1)} />
      </details>
      <Directory<Service>
        key={'list' + version}
        path="services"
        label="dịch vụ"
      >
        {(rows, reload) =>
          rows.map((s) => (
            <details key={s.id}>
              <summary>
                {s.name} · {price(s.priceVnd)} ·{' '}
                {s.active ? 'Hoạt động' : 'Đã ngừng'}
              </summary>
              <ServiceForm row={s} done={reload} />
            </details>
          ))
        }
      </Directory>
    </>
  );
}
function StaffForm({ row, done }: { row?: Employee; done: () => void }) {
  const { save, busy, feedback } = useChange();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      displayName: String(f.get('displayName')).trim(),
      bio: String(f.get('bio')).trim(),
      ...(row
        ? { active: f.has('active') }
        : { email: f.get('email'), password: f.get('password') }),
    };
    if (
      await save(
        '/staff' + (row ? '/' + row.id : ''),
        row ? 'PATCH' : 'POST',
        body,
        row
          ? 'Lưu hồ sơ và trạng thái nhân viên? Lịch đã đặt được giữ nguyên.'
          : 'Tạo tài khoản nhân viên?',
      )
    )
      done();
  }
  return (
    <>
      <form method="post" className="admin-form" onSubmit={submit}>
        <label>
          Tên nhân viên
          <input
            name="displayName"
            required
            maxLength={100}
            defaultValue={row?.displayName}
          />
        </label>
        {!row && (
          <>
            <label>
              Email
              <input type="email" name="email" required maxLength={254} />
            </label>
            <label>
              Mật khẩu ban đầu
              <input
                type="password"
                name="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
              />
            </label>
          </>
        )}
        <label>
          Giới thiệu
          <textarea name="bio" maxLength={1000} defaultValue={row?.bio} />
        </label>
        {row && (
          <label>
            <input type="checkbox" name="active" defaultChecked={row.active} />{' '}
            Tài khoản hoạt động
          </label>
        )}
        <button className="primary" disabled={busy}>
          {row ? 'Lưu hồ sơ' : 'Tạo nhân viên'}
        </button>
      </form>
      {feedback}
    </>
  );
}
function Assignments({ row, done }: { row: Employee; done: () => void }) {
  const [ids, setIds] = useState(row.serviceIds);
  const { save, busy, feedback } = useChange();
  return (
    <section>
      <h3>Phân công dịch vụ</h3>
      <Directory<Service> path="services" label="dịch vụ phân công">
        {(rows) =>
          rows.map((s) => (
            <label className="check-row" key={s.id}>
              <input
                type="checkbox"
                checked={ids.includes(s.id)}
                onChange={(e) =>
                  setIds(
                    e.target.checked
                      ? [...ids, s.id]
                      : ids.filter((id) => id !== s.id),
                  )
                }
              />{' '}
              {s.name}
              {!s.active && ' (đã ngừng)'}
            </label>
          ))
        }
      </Directory>
      <button
        className="secondary"
        disabled={busy}
        onClick={async () => {
          if (
            await save(
              '/staff/' + row.id + '/services',
              'PUT',
              { serviceIds: ids },
              'Thay danh sách phân công? Lịch đã đặt vẫn được giữ.',
            )
          )
            done();
        }}
      >
        Lưu phân công
      </button>
      {feedback}
    </section>
  );
}
export function Employees() {
  const [version, update] = useState(0);
  return (
    <>
      <h1>Nhân viên</h1>
      <details key={version}>
        <summary>Thêm nhân viên</summary>
        <StaffForm done={() => update((n) => n + 1)} />
      </details>
      <Directory<Employee>
        key={'list' + version}
        path="staff"
        label="nhân viên"
      >
        {(rows, reload) =>
          rows.map((s) => (
            <details key={s.id}>
              <summary>
                {s.displayName} · {s.email} ·{' '}
                {s.active ? 'Hoạt động' : 'Đã ngừng'}
              </summary>
              <StaffForm row={s} done={reload} />
              <Assignments row={s} done={reload} />
              <Link
                className="text-link"
                href={'/admin/ca-lam?staffId=' + s.id}
              >
                Quản lý ca làm
              </Link>
            </details>
          ))
        }
      </Directory>
    </>
  );
}
