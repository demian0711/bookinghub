'use client';
import { useResource } from '@/lib/use-resource';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, Clock3, Scissors } from 'lucide-react';
import { price, type Service, type ServicePage } from '@/lib/catalog';
function Feedback({ error, retry }: { error?: number; retry: () => void }) {
  if (error === undefined)
    return (
      <p role="status" className="notice">
        Đang tải dịch vụ…
      </p>
    );
  if (error === 404 || error === 400)
    return <p className="notice">Dịch vụ này hiện không có trong danh mục.</p>;
  return (
    <div role="alert" className="notice">
      Chưa tải được dịch vụ. <button onClick={retry}>Thử lại</button>
    </div>
  );
}
export function Catalog({ featured = false }: { featured?: boolean }) {
  const [page, setPage] = useState(1);
  const { result, retry } = useResource<ServicePage>(
    '/api/v1/services?pageSize=' + (featured ? 3 : 9) + '&page=' + page,
  );
  if (!result || 'error' in result)
    return <Feedback error={result?.error} retry={retry} />;
  return (
    <>
      {result.data.items.length === 0 ? (
        <p className="notice">Salon chưa có dịch vụ để hiển thị.</p>
      ) : (
        <ul className="service-grid">
          {result.data.items.map((s) => (
            <li key={s.id}>
              <Link href={'/dich-vu/' + s.id} className="service-card">
                <span className="card-top">
                  <Scissors size={21} />
                  <ArrowUpRight size={19} />
                </span>
                <h3>{s.name}</h3>
                <p>{s.description}</p>
                <span className="card-meta">
                  <span>
                    <Clock3 size={15} /> {s.durationMinutes} phút
                  </span>
                  <strong>{price(s.priceVnd)}</strong>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!featured && (page > 1 || result.data.hasNext) && (
        <nav aria-label="Phân trang" className="actions">
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
            disabled={!result.data.hasNext}
            onClick={() => setPage(page + 1)}
          >
            Trang sau
          </button>
        </nav>
      )}
    </>
  );
}
export function ServiceDetail({ id }: { id: string }) {
  const { result, retry } = useResource<Service>(
    '/api/v1/services/' + encodeURIComponent(id),
  );
  if (!result || 'error' in result)
    return <Feedback error={result?.error} retry={retry} />;
  const s = result.data;
  return (
    <article className="detail">
      <Scissors aria-hidden="true" />
      <h1>{s.name}</h1>
      <p>{s.description}</p>
      <dl>
        <div>
          <dt>Thời lượng</dt>
          <dd>{s.durationMinutes} phút</dd>
        </div>
        <div>
          <dt>Giá dịch vụ</dt>
          <dd>{price(s.priceVnd)}</dd>
        </div>
      </dl>
      <Link className="primary" href={'/dat-lich?serviceId=' + s.id}>
        Chọn nhân viên và giờ
      </Link>
    </article>
  );
}
