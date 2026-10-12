export type StreamErrorCode = 'PAYLOAD_TOO_LARGE' | 'STREAM_READ_FAILED' | 'EMPTY_BODY';

export interface BoundedStreamResult {
  text?: string;
  error?: string;
  code?: StreamErrorCode;
}

export async function readBoundedStream(request: Request, limit: number): Promise<BoundedStreamResult> {
  if (!request.body) {
    return { error: 'Empty request body.', code: 'EMPTY_BODY' };
  }
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let byteCount = 0;
  let rawText = '';
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        byteCount += value.length;
        if (byteCount > limit) {
          await reader.cancel();
          return { error: 'Payload too large.', code: 'PAYLOAD_TOO_LARGE' };
        }
        rawText += decoder.decode(value, { stream: true });
      }
    }
    rawText += decoder.decode();
  } catch {
    return { error: 'Stream read failed.', code: 'STREAM_READ_FAILED' };
  }
  
  if (!rawText.trim()) {
    return { error: 'Empty request body.', code: 'EMPTY_BODY' };
  }

  return { text: rawText };
}
