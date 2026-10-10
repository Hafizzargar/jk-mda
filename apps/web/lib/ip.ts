export function extractClientIp(request: Request): string | null {
  const vercelIp = request.headers.get('x-vercel-forwarded-for');
  if (vercelIp) {
    return vercelIp.split(',')[0].trim();
  }

  // Safe fallback for local development only
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim();
    }
    return '127.0.0.1'; // Default local IP
  }

  return null;
}
