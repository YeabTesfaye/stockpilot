export const SESSION_COOKIE = 'stockpilot_session';

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

/**
 * HttpOnly + SameSite=Lax: the token never touches JS, and the cookie rides
 * along on same-site navigations (login redirects) without being sent on
 * cross-site subresource requests.
 */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: THIRTY_DAYS_SECONDS,
  };
}
