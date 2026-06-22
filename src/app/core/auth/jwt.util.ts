export interface JwtClaims {
  sub?: string;
  email?: string;
  name?: string;
  role?: string;
  roleId?: string;
  exp?: number;
  iss?: string;
  aud?: string;
  [key: string]: unknown;
}

/**
 * Decode a JWT payload (no signature verification — server is the source of truth).
 * Returns null if the token is malformed.
 */
export function decodeJwt(token: string): JwtClaims | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const json = atob(padded);

    const decoded = decodeURIComponent(
      json.split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );

    return JSON.parse(decoded) as JwtClaims;
  } catch {
    return null;
  }
}
