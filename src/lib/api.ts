/**
 * Safe API client for Vercel Serverless / Express backend.
 *
 * Prevents "Unexpected token 'A', 'A server e'... is not valid JSON" by:
 * 1. Checking `res.ok` before attempting `res.json()`.
 * 2. Reading plain text errors when HTTP status is not 2xx.
 * 3. Providing descriptive, actionable error messages for the UI.
 */
export async function apiFetch<T = any>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);

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
      // Plain text response from Vercel or proxy (e.g. "A server error occurred")
      if (text.toLowerCase().includes('server error')) {
        errorMessage = `${text.trim()} (Check Vercel Project → Functions → Logs or DATABASE_URL config)`;
      } else if (!text.trim()) {
        errorMessage = `HTTP ${res.status} ${res.statusText}`;
      }
    }

    throw new Error(errorMessage || `Request failed with status ${res.status}`);
  }

  // At this point, response is 2xx OK
  try {
    return (await res.json()) as T;
  } catch (err: any) {
    throw new Error(`Failed to parse server response as JSON: ${err?.message || 'Invalid format'}`);
  }
}
