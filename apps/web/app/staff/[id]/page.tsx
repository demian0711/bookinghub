import { StaffDetail } from '@/components/staff-detail';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StaffDetail key={id} id={id} />;
}
