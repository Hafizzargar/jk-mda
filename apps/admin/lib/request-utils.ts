export const MAX_ARTICLE_PAYLOAD_BYTES = 512 * 1024; // 512 KB payload limit
export const DEFAULT_MAX_PAYLOAD_BYTES = 64 * 1024; // 64 KB for smaller admin forms

export type BoundedJsonResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; status: number };

/**
 * Reads a request body with an enforced maximum byte limit.
 * Checks Content-Length header up front and streams chunks incrementally to
 * ensure large payloads are rejected before consuming server memory.
 */
export async function readBoundedJson<T = unknown>(
  request: Request,
  maxBytes: number = MAX_ARTICLE_PAYLOAD_BYTES
): Promise<BoundedJsonResult<T>> {
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const parsedLength = parseInt(contentLength, 10);
    if (!isNaN(parsedLength) && parsedLength > maxBytes) {
      return { success: false, error: 'Payload too large', status: 413 };
    }
  }

  if (!request.body) {
    return { success: false, error: 'Empty request body', status: 400 };
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
        if (byteCount > maxBytes) {
          await reader.cancel();
          return { success: false, error: 'Payload too large', status: 413 };
        }
        rawText += decoder.decode(value, { stream: true });
      }
    }
    rawText += decoder.decode();
  } catch {
    return { success: false, error: 'Failed to read request body', status: 400 };
  }

  if (!rawText.trim()) {
    return { success: false, error: 'Empty request body', status: 400 };
  }

  try {
    const parsed = JSON.parse(rawText) as T;
    return { success: true, data: parsed };
  } catch {
    return { success: false, error: 'Invalid JSON body', status: 400 };
  }
}
