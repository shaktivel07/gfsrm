/**
 * Safe API client for Vercel Serverless / Express backend.
 *
 * Features:
 * 1. Automatic retries with exponential backoff on transient network failures ('Failed to fetch').
 * 2. Timeout handling via AbortSignal.
 * 3. Graceful parsing of JSON and text error responses.
 */
export async function apiFetch<T = any>(
  url: string,
  options?: RequestInit,
  retries: number = (!options?.method || options.method.toUpperCase() === 'GET') ? 2 : 0
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // 10s timeout per attempt
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(url, {
        ...options,
        signal: options?.signal || controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text();
        let errorMessage = text;

        try {
          const parsed = JSON.parse(text);
          if (parsed.error) {
            errorMessage = parsed.error;
          } else if (parsed.message) {
            errorMessage = parsed.message;
          }
        } catch {
          // Plain text response from Vercel or proxy
          if (text.toLowerCase().includes('server error')) {
            errorMessage = `${text.trim()} (Check Vercel Project → Functions → Logs or DATABASE_URL config)`;
          } else if (!text.trim()) {
            errorMessage = `HTTP ${res.status} ${res.statusText}`;
          }
        }

        throw new Error(errorMessage || `Request failed with status ${res.status}`);
      }

      // Response is 2xx OK
      return (await res.json()) as T;
    } catch (err: any) {
      lastError = err;
      const isNetworkOrAbort =
        err?.name === 'AbortError' ||
        err?.message?.includes('Failed to fetch') ||
        err?.message?.includes('NetworkError') ||
        err?.message?.includes('Load failed');

      // Retry on network errors or transient startup failures for GET requests
      if (attempt < retries && isNetworkOrAbort) {
        await new Promise((resolve) => setTimeout(resolve, 400 * Math.pow(2, attempt)));
        continue;
      }
      break;
    }
  }

  throw lastError;
}
