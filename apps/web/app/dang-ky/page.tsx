import { AuthForm } from '@/components/auth-form';
import { returnPath } from '@/lib/account';
export const metadata = { title: 'Đăng ký' };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  return (
    <AuthForm
      register={true}
      next={returnPath(q.next)}
      created={q.created === '1'}
    />
  );
}
