import { jwtDecode } from 'jwt-decode';

/**
 * True when the access token is past `exp` or within `skewSeconds` of it —
 * the cue for the proxy to silently rotate before the token actually dies.
 * A malformed / undecodable token is treated as expired.
 */
export function isExpiredOrNearExpiry(token: string, skewSeconds = 60): boolean {
  try {
    const { exp } = jwtDecode<{ exp?: number }>(token);
    if (!exp) return true;
    return exp * 1000 <= Date.now() + skewSeconds * 1000;
  } catch {
    return true;
  }
}
