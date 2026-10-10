export async function readBoundedStream(request: Request, limit: number): Promise<{ text?: string; error?: string }> {
  let rawText = '';
  if (request.body) {
    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let byteCount = 0;
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          byteCount += value.length;
          if (byteCount > limit) {
            await reader.cancel();
            return { error: 'Payload too large.' };
          }
          rawText += decoder.decode(value, { stream: true });
        }
      }
      rawText += decoder.decode();
    } catch {
      return { error: 'Stream read failed.' };
    }
  }
  return { text: rawText };
}
