const PATIENT_BASE_URLS = Array.from(
  new Set(
    [
      import.meta.env.VITE_API_BASE_URL,
      'http://localhost:8000/api/patients',
      'http://localhost:8002/api/patients'
    ].filter(Boolean)
  )
);

export async function patientRequest(path, getToken, options = {}) {
  let lastFailure = null;
  const timeoutMs = 8000;

  for (const baseUrl of PATIENT_BASE_URLS) {
    try {
      const token = await getToken();
      const headers = { ...(options.headers || {}) };
      if (token) headers.Authorization = `Bearer ${token}`;

      let body = options.body;
      if (body && typeof body === 'object' && !(body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(body);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers,
        body,
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutId));

      const data = await response.json().catch(() => ({}));

      if (response.ok) return data;

      const isServerUnavailable = [502, 503, 504].includes(response.status);
      if (isServerUnavailable) {
        lastFailure = new Error(`Cannot reach backend at ${baseUrl}.`);
        continue;
      }

      throw new Error(data.message || `Request failed (${response.status})`);
    } catch (error) {
      lastFailure =
        error?.name === 'AbortError'
          ? new Error(`Request timed out after ${timeoutMs / 1000}s at ${baseUrl}.`)
          : error;
      const isNetworkError = error?.name === 'TypeError' || error?.name === 'AbortError';
      if (!isNetworkError) throw error;
    }
  }

  throw new Error(
    lastFailure?.message ||
      'Cannot connect to patient service. Start Patient Service (port 8002) or API gateway (port 8000).'
  );
}
