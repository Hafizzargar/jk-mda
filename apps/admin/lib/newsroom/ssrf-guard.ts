/**
 * SSRF Safety Guard
 * Prevents Server-Side Request Forgery by strictly validating configured news and government source URLs.
 * Rejects private IPs, loopback hosts, link-local addresses, and cloud metadata endpoints.
 */

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
  'instance-data',
]);

const PRIVATE_IP_PATTERNS = [
  /^10\./, // 10.0.0.0/8
  /^192\.168\./, // 192.168.0.0/16
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
  /^169\.254\./, // 169.254.0.0/16 Link-Local & AWS/GCP metadata
  /^127\./, // 127.0.0.0/8 Loopback
  /^0\./, // 0.0.0.0/8
  /^fc00:/i, // IPv6 Unique Local Address
  /^fe80:/i, // IPv6 Link-Local
];

export interface SsrfValidationResult {
  isValid: boolean;
  normalizedUrl?: string;
  error?: string;
}

export function validateSourceUrl(inputUrl: string): SsrfValidationResult {
  if (!inputUrl || typeof inputUrl !== 'string') {
    return { isValid: false, error: 'URL must be a non-empty string.' };
  }

  const trimmed = inputUrl.trim();
  if (trimmed.length > 2048) {
    return { isValid: false, error: 'URL exceeds maximum length of 2048 characters.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { isValid: false, error: 'Malformed URL.' };
  }

  // Enforce HTTP / HTTPS protocols only
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { isValid: false, error: `Disallowed protocol: ${parsed.protocol}. Only http and https are allowed.` };
  }

  // Reject embedded credentials (http://user:pass@host)
  if (parsed.username || parsed.password) {
    return { isValid: false, error: 'URLs with embedded user credentials are not permitted.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Check against static blocked list
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { isValid: false, error: 'Access to loopback or metadata hostnames is forbidden.' };
  }

  // Reject internal and private IP ranges
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return { isValid: false, error: 'Access to private or link-local IP addresses is forbidden.' };
    }
  }

  // Reject non-standard ports (only allow default 80, 443, or empty)
  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') {
    return { isValid: false, error: `Disallowed port: ${parsed.port}. Only standard ports 80/443 are permitted.` };
  }

  return {
    isValid: true,
    normalizedUrl: parsed.toString(),
  };
}
