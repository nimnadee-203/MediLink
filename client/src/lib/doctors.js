const DOCTOR_SOURCES = [
  {
    type: 'doctor-service',
    baseUrl: import.meta.env.VITE_DOCTOR_API_BASE_URL || 'http://localhost:8000/api/doctor'
  },
  { type: 'doctor-service', baseUrl: 'http://localhost:4000/api/doctor' },
  {
    type: 'patients',
    baseUrl: import.meta.env.VITE_PATIENT_DOCTOR_API_BASE_URL || 'http://localhost:8000/api/patients'
  },
  { type: 'patients', baseUrl: 'http://localhost:8002/api/patients' }
].filter((item) => Boolean(item.baseUrl));

const DEFAULT_DOCTOR_IMAGE =
  'https://ui-avatars.com/api/?name=Doctor&background=1d4ed8&color=fff&size=200&bold=true';

const FALLBACK_SPECIALITY = 'General Physician';

export function formatDoctorDisplayName(name, fallback = 'Doctor') {
  const baseName = typeof name === 'string' && name.trim() ? name.trim() : fallback;
  if (/^dr\.?\s+/i.test(baseName)) {
    return baseName.replace(/^dr\.?\s+/i, 'Dr. ');
  }
  return `Dr. ${baseName}`;
}

export const CONSULTATION_MODE_LABELS = {
  in_person_only: 'In-person only',
  both: 'In-person + Telemedicine'
};

export const TIME_SLOTS = [
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00'
];

function normalizeDoctor(raw) {
  if (!raw) return null;

  const id = String(raw._id || raw.id || '');
  if (!id) return null;

  const fees = Number(raw.fees);

  return {
    _id: id,
    name: raw.name || 'Doctor',
    speciality: raw.speciality || FALLBACK_SPECIALITY,
    degree: raw.degree || 'MBBS',
    experience: raw.experience || '1 Year',
    fees: Number.isFinite(fees) ? fees : 0,
    available: typeof raw.available === 'boolean' ? raw.available : true,
    consultationMode: raw.consultationMode === 'both' ? 'both' : 'in_person_only',
    image: raw.image || DEFAULT_DOCTOR_IMAGE,
    about: raw.about || 'Experienced clinician.',
    address: raw.address || 'Sri Lanka',
    slots_booked: raw.slots_booked || {}
  };
}

function buildPath(sourceType, kind, doctorId) {
  if (sourceType === 'patients') {
    return kind === 'list' ? '/doctors/public' : `/doctors/public/${encodeURIComponent(doctorId)}`;
  }

  return kind === 'list' ? '/list' : `/${encodeURIComponent(doctorId)}`;
}

async function requestDoctors(kind, doctorId = '') {
  let lastError;

  for (const source of DOCTOR_SOURCES) {
    try {
      const path = buildPath(source.type, kind, doctorId);
      const response = await fetch(`${source.baseUrl}${path}`);
      const data = await response.json().catch(() => ({}));

      if (response.ok) return data;

      const isRetriable = [404, 502, 503, 504].includes(response.status);
      if (isRetriable) {
        lastError = new Error(data.message || `Cannot reach doctors API at ${source.baseUrl}`);
        continue;
      }

      throw new Error(data.message || `Doctors request failed (${response.status})`);
    } catch (error) {
      lastError = error;
      const isNetworkError = error?.name === 'TypeError';
      if (!isNetworkError) throw error;
    }
  }

  throw new Error(lastError?.message || 'Cannot reach doctors API.');
}

export async function fetchDoctors() {
  const data = await requestDoctors('list');
  const doctors = Array.isArray(data?.doctors) ? data.doctors : [];
  return doctors.map(normalizeDoctor).filter(Boolean);
}

export async function fetchDoctorById(doctorId) {
  if (!doctorId) return null;
  const data = await requestDoctors('one', doctorId);
  return normalizeDoctor(data?.doctor);
}

export async function fetchDoctorsByIds(ids) {
  const uniqueIds = [...new Set((ids || []).filter(Boolean).map(String))];
  const pairs = await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        const doctor = await fetchDoctorById(id);
        return [id, doctor];
      } catch {
        return [id, null];
      }
    })
  );

  return Object.fromEntries(pairs);
}
