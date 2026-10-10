import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node.js test runner with custom ESM loader requires .ts extension here
import { readBoundedStream } from '../lib/request-utils.ts';

describe('P0: Bounded Stream Reader', () => {
  it('reads a valid payload correctly', async () => {
    const payload = JSON.stringify({ email: 'test@example.com' });
    const req = new Request('http://localhost', {
      method: 'POST',
      body: payload
    });
    
    const result = await readBoundedStream(req, 2000);
    assert.strictEqual(result.error, undefined);
    assert.strictEqual(result.text, payload);
  });

  it('aborts and returns an error when payload exceeds limit', async () => {
    const oversizedPayload = 'a'.repeat(2500);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: oversizedPayload
    });
    
    const result = await readBoundedStream(req, 2000);
    assert.strictEqual(result.error, 'Payload too large.');
    assert.strictEqual(result.text, undefined);
  });
});
