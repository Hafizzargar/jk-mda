import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node.js test runner with custom ESM loader requires .ts extension here
import { extractClientIp } from '../lib/ip.ts';

describe('P2: Client IP Extraction Trust', () => {
  const mockEnv = (nodeEnv: string) => {
    const originalHasEnv = 'NODE_ENV' in process.env;
    const orig = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = nodeEnv;
    return () => { 
      if (originalHasEnv) {
        (process.env as any).NODE_ENV = orig;
      } else {
        delete (process.env as any).NODE_ENV;
      }
    };
  };

  it('does not fall through to dev fallback if trusted header is present but malformed in test environment', () => {
    const restore = mockEnv('test');
    try {
      // The trusted header is invalid, so it should return null instead of falling through to x-forwarded-for or default loopback
      const req = new Request('http://localhost', {
        headers: { 
          'x-vercel-forwarded-for': 'not-an-ip',
          'x-forwarded-for': '127.0.0.1' 
        }
      });
      assert.strictEqual(extractClientIp(req), null, 'Must reject immediately if trusted header is invalid');
    } finally {
      restore();
    }
  });

  it('trusts x-vercel-forwarded-for as the primary secure header', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-vercel-forwarded-for': '203.0.113.1, 10.0.0.1' }
    });
    
    assert.strictEqual(extractClientIp(req), '203.0.113.1', 'Should extract leftmost IP from Vercel header');
  });

  it('rejects untrusted headers in production', () => {
    const restore = mockEnv('production');
    try {
      // Malicious user tries to spoof x-forwarded-for directly to bypass Vercel
      const req1 = new Request('http://localhost', {
        headers: { 'x-forwarded-for': '198.51.100.1' }
      });
      assert.strictEqual(extractClientIp(req1), null, 'Must reject arbitrary x-forwarded-for in production if vercel header is missing');
      
      const req2 = new Request('http://localhost', {
        headers: { 'x-real-ip': '198.51.100.1' }
      });
      assert.strictEqual(extractClientIp(req2), null, 'Must reject x-real-ip entirely');
      
      const req3 = new Request('http://localhost');
      assert.strictEqual(extractClientIp(req3), null, 'Must return null when no recognized headers are present');
    } finally {
      restore();
    }
  });

  it('rejects empty, whitespace, and malformed IPs in trusted headers', () => {
    // Empty header
    const req1 = new Request('http://localhost', { headers: { 'x-vercel-forwarded-for': '' } });
    assert.strictEqual(extractClientIp(req1), null);

    // Whitespace only
    const req2 = new Request('http://localhost', { headers: { 'x-vercel-forwarded-for': '   ' } });
    assert.strictEqual(extractClientIp(req2), null);

    // Malformed IP
    const req3 = new Request('http://localhost', { headers: { 'x-vercel-forwarded-for': 'not-an-ip' } });
    assert.strictEqual(extractClientIp(req3), null);

    // Comma-separated with invalid first value
    const req4 = new Request('http://localhost', { headers: { 'x-vercel-forwarded-for': 'invalid-ip, 203.0.113.1' } });
    assert.strictEqual(extractClientIp(req4), null);
  });

  it('allows x-forwarded-for fallback during local development', () => {
    const restore = mockEnv('development');
    try {
      const req = new Request('http://localhost', {
        headers: { 'x-forwarded-for': '127.0.0.1' }
      });
      assert.strictEqual(extractClientIp(req), '127.0.0.1', 'Should allow fallback header in dev');
    } finally {
      restore();
    }
  });

  it('provides a default local IP during local development if headers are missing', () => {
    const restore = mockEnv('development');
    try {
      const req = new Request('http://localhost');
      assert.strictEqual(extractClientIp(req), '127.0.0.1', 'Should provide default loopback in dev');
    } finally {
      restore();
    }
  });
});
