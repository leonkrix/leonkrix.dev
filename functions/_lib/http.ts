/** JSON response that is never cached and never sniffed. */
export function json(body: Record<string, unknown>, status = 200, headers?: HeadersInit): Response {
  const response = new Response(JSON.stringify(body), {
    status,
    headers: headers ?? {},
  });
  response.headers.set('Content-Type', 'application/json; charset=utf-8');
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
}

/**
 * Reads the request body as UTF-8 text, but never more than `limit` bytes. The Content-Length
 * header is only a first hint (a client can lie or leave it out), so the stream is counted too.
 * Returns undefined when the body is too large or not valid UTF-8.
 */
export async function readLimitedText(
  request: Request,
  limit: number,
): Promise<string | undefined> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limit) {
    return undefined;
  }
  if (request.body === null) {
    return '';
  }

  const reader = request.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const result: ReadableStreamReadResult<Uint8Array> = await reader.read();
    if (result.done) {
      break;
    }
    const value = result.value;
    received += value.byteLength;
    if (received > limit) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    return undefined;
  }
}
