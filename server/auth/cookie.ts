export const SESSION_COOKIE = 'stockpilot_session';

export const SESSION_COOKIE_SECONDS = 30 * 24 * 60 * 60;

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function isSecureContext(): boolean {
  // In production, cookies are Secure. In dev we keep them non-Secure so
  // localhost HTTP still works, but we still set the remaining attributes.
  return isProduction();
}

/**
 * HttpOnly + Secure (prod) + SameSite=Lax: the token never touches JS, and
 * the cookie rides along on same-site navigations (login redirects) without
 * being sent on cross-site subresource requests.
 *
 * In production the cookie is flagged Secure so browsers only send it over
 * HTTPS. The app still works on plain HTTP in dev.
 */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: isSecureContext(),
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_COOKIE_SECONDS,
  };
}

/**
 * Same options but with maxAge: 0 so the browser clears the cookie.
 * Used by the logout endpoint.
 */
export function sessionCookieClearOptions() {
  return {
    ...sessionCookieOptions(),
    maxAge: 0,
    value: '',
  };
}
