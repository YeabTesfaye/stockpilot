import { hash, verify } from 'argon2';

/**
 * argon2id by default. The hash is self-describing (salt + params embedded),
 * so no bcrypt-style 72-byte truncation footgun and no separate salt column.
 */
export function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

export async function verifyPassword(
  hashStr: string,
  plain: string,
): Promise<boolean> {
  try {
    return await verify(hashStr, plain);
  } catch {
    // Malformed hash (e.g. not an argon2 string) — never throw, just fail.
    return false;
  }
}
