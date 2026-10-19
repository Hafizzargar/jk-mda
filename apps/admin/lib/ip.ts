import { isIP } from 'node:net';

export function extractClientIp(request: Request): string | null {
  const vercelIp = request.headers.get('x-vercel-forwarded-for');
  if (vercelIp !== null) {
    const ip = vercelIp.split(',')[0].trim();
    if (isIP(ip)) return ip;
    return null;
  }

  // Safe fallback for local development only
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
      const ip = forwardedFor.split(',')[0].trim();
      if (isIP(ip)) return ip;
    }
    return '127.0.0.1'; // Default local IP
  }

  return null;
}
