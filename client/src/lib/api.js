const APPOINTMENT_BASE_URLS = [
  'http://localhost:8000/api/appointments',
  'http://localhost:8004/api/appointments'
];

export async function appointmentRequest(path, getToken, options = {}) {
  let lastFailure = null;

  for (const baseUrl of APPOINTMENT_BASE_URLS) {
    try {
      const token = await getToken();
      const headers = { ...(options.headers || {}) };
      if (token) headers.Authorization = `Bearer ${token}`;

      let body = options.body;
      if (body && typeof body === 'object' && !(body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(body);
      }

      const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers,
        body
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) return data;

      const isServerUnavailable = [502, 503, 504].includes(response.status);
      if (isServerUnavailable) {
        lastFailure = new Error(`Cannot reach backend at ${baseUrl}.`);
        continue;
      }

      throw new Error(data.message || `Request failed (${response.status})`);
    } catch (error) {
      lastFailure = error;
      const isNetworkError = error?.name === 'TypeError';
      if (!isNetworkError) throw error;
    }
  }

  throw new Error(
    lastFailure?.message ||
    'Cannot connect to Appointment Service. Start it on port 8004 (or API Gateway on port 8000) and MongoDB.'
  );
}
