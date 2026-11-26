import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, MoveUpRight } from 'lucide-react';
import { Catalog } from '@/components/catalog';
export default function Home() {
  return (
    <div className="shell">
      <section className="hero">
        <div className="hero-copy">
          <h1>
            Một cuộc hẹn
            <br />
            cho <em>mái tóc.</em>
          </h1>
          <p>
            Khám phá dịch vụ chăm sóc tóc và chọn dịch vụ phù hợp cho lần ghé
            salon tiếp theo.
          </p>
          <Link className="primary" href="/dich-vu">
            Đặt lịch salon <ArrowRight size={18} />
          </Link>
        </div>
        <div className="hero-photo">
          <Image
            src="/salon.jpg"
            alt="Không gian tạo kiểu tóc với gương và ghế salon"
            fill
            sizes="(max-width: 700px) 95vw, 50vw"
            priority
          />
        </div>
      </section>
      <section className="catalog-section">
        <div className="section-head">
          <h2>Dịch vụ tại salon</h2>
          <Link className="text-link" href="/dich-vu">
            Xem tất cả <MoveUpRight size={17} />
          </Link>
        </div>
        <Catalog featured />
      </section>
    </div>
  );
}
