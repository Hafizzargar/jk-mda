import crypto from 'crypto';

function getSecretKey(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'kjin-auth-session-revocation-secret-key-2026'
  );
}

/**
 * Creates a cryptographically signed, tamper-proof, time-limited token
 * that allows revoking all device sessions from an alert email.
 */
export function createLogoutToken(userId: string): { uid: string; exp: number; sig: string } {
  // Token is valid for 48 hours from creation
  const exp = Math.floor(Date.now() / 1000) + 48 * 3600;
  const data = `${userId}:${exp}`;
  const sig = crypto.createHmac('sha256', getSecretKey()).update(data).digest('hex');
  return { uid: userId, exp, sig };
}

/**
 * Validates the signature and expiration time of a remote session revocation token.
 */
export function verifyLogoutToken(userId: string, exp: number, sig: string): boolean {
  try {
    if (!userId || !exp || !sig) return false;

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (now > exp) return false;

    const data = `${userId}:${exp}`;
    const expectedSig = crypto.createHmac('sha256', getSecretKey()).update(data).digest('hex');

    const sigBuf = Buffer.from(sig, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');

    if (sigBuf.length !== expectedBuf.length) return false;

    return crypto.timingSafeEqual(sigBuf, expectedBuf);
  } catch {
    return false;
  }
}
