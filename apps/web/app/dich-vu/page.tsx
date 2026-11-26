import { Catalog } from '@/components/catalog';
export const metadata = { title: 'Dịch vụ' };
export default function Page() {
  return (
    <section className="shell inner">
      <h1>Dịch vụ tại salon</h1>
      <p className="intro">Chọn dịch vụ để xem thời lượng và giá.</p>
      <Catalog />
    </section>
  );
}
