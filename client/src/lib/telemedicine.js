const STORAGE_KEY = 'medisync.telemedicine.visitModes.v1';

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function saveAppointmentVisitMode(appointmentId, visitMode) {
  if (!appointmentId || !visitMode || typeof window === 'undefined') return;
  const store = readStore();
  store[String(appointmentId)] = visitMode;
  writeStore(store);
}

export function getAppointmentVisitMode(appointmentId) {
  if (!appointmentId || typeof window === 'undefined') return null;
  const store = readStore();
  return store[String(appointmentId)] || null;
}

export function getResolvedVisitMode(appointment, doctor) {
  if (!appointment) return 'in_person';

  if (appointment.visitMode === 'telemedicine' || appointment.visitMode === 'in_person') {
    return appointment.visitMode;
  }

  const fromStorage = getAppointmentVisitMode(appointment.id || appointment._id);
  if (fromStorage === 'telemedicine' || fromStorage === 'in_person') {
    return fromStorage;
  }

  if (doctor?.consultationMode === 'in_person_only') {
    return 'in_person';
  }

  return 'in_person';
}

export function buildMockRoomName(appointment) {
  const id = String(appointment?.id || appointment?._id || 'session');
  const safeId = id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24) || 'session';
  return `MediLink-${safeId}`;
}
