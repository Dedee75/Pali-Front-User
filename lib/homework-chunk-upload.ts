// One chunk is in flight per upload. Retrying a chunk never resends completed chunks.
export async function sendHomeworkChunks(input: {
  api: string; homeworkId: string; attemptId: string; token: string;
  files: File[]; retainedImageIds: number[]; signal: AbortSignal;
  progress: (percent: number) => void;
}) {
  const base = `${input.api}/student-homeworks/${input.homeworkId}/uploads`;
  const request = async (url: string, make: () => RequestInit, timeout = 30000) => {
    for (let attempt = 0; ; attempt++) {
      input.signal.throwIfAborted();
      let retryAfter = 0;
      try {
        const init = make();
        const response = await fetch(url, {...init, headers: {...init.headers, Authorization: `Bearer ${input.token}`}, signal: AbortSignal.any([input.signal, AbortSignal.timeout(timeout)])});
        if (response.ok) return await response.json();
        const result = await response.json().catch(() => null);
        const message = typeof result?.message === 'string' ? result.message : `Upload failed (${response.status})`;
        if (![408, 429, 500, 502, 503, 504].includes(response.status)) throw Object.assign(new Error(message), {permanent: true});
        retryAfter = Math.min(30000, Math.max(0, Number(response.headers.get('Retry-After')) || 0) * 1000);
        throw new Error(message);
      } catch (error) {
        if (input.signal.aborted || attempt >= 6 || (error instanceof Error && 'permanent' in error)) throw error;
        const delay = Math.max(retryAfter, Math.min(15000, 1000 * 2 ** attempt)) + Math.random() * 500;
        await new Promise<void>((resolve, reject) => {
          const abort = () => {clearTimeout(timer); reject(new DOMException('Upload cancelled', 'AbortError'));};
          const timer = setTimeout(() => {input.signal.removeEventListener('abort', abort); resolve();}, delay);
          input.signal.addEventListener('abort', abort, {once: true});
          if (input.signal.aborted) abort();
        });
      }
    }
  };
  const session = await request(base, () => ({method: 'POST', body: JSON.stringify({attemptId: input.attemptId, retainedImageIds: input.retainedImageIds, files: input.files.map(f => ({name: f.name, type: f.type, size: f.size}))}), headers: {'Content-Type': 'application/json'}}));
  if (!/^[a-f0-9]{64}$/.test(session.uploadId) || typeof session.chunkBytes !== 'number' || session.chunkBytes < 64 * 1024) throw new Error('Invalid upload session');
  const total = input.files.reduce((n, f) => n + f.size, 0);
  let received = 0;
  for (const [i, file] of input.files.entries()) {
    for (let offset = 0, c = 0; offset < file.size; offset += session.chunkBytes, c++) {
      const chunk = file.slice(offset, offset + session.chunkBytes);
      await request(`${base}/${session.uploadId}/${i}/${c}`, () => {const body = new FormData(); body.append('chunk', chunk, 'chunk.bin'); return {method: 'PUT', body};});
      received += chunk.size;
      input.progress(Math.min(99, Math.round(received / Math.max(1, total) * 100)));
    }
  }
  return request(`${base}/${session.uploadId}/commit`, () => ({method: 'POST'}), 180000);
}
