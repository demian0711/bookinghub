import { MyAppointments } from '@/components/my-appointments';
export const metadata = { title: 'Chi tiết lịch hẹn' };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  return (
    <MyAppointments
      key={id}
      id={id}
      created={(await searchParams).created === '1'}
    />
  );
}
