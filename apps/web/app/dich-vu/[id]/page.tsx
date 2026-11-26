import Link from 'next/link';
import { ServiceDetail } from '@/components/catalog';
export const metadata = { title: 'Chi tiết dịch vụ' };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <section className="shell inner">
      <Link href="/dich-vu" className="text-link">
        ← Danh mục dịch vụ
      </Link>
      <ServiceDetail id={id} />
    </section>
  );
}
