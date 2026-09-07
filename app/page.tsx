import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/server/auth/session';
import { SESSION_COOKIE } from '@/server/auth/cookie';
import { HomePage } from './home-page';

export default async function LandingPage() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const session = await getSessionUser(token);
    if (session) {
      redirect('/dashboard');
    }
  }

  return <HomePage />;
}
