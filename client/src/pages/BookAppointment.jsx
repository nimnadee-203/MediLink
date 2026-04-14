import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import {
  Clock,
  MapPin,
  Calendar,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Award,
  Loader2,
  ChevronRight,
  Info,
  Stethoscope,
  RefreshCw,
  Video,
  FileText
} from 'lucide-react';
import { cn, Card, Button } from '../components/ui';
import { TIME_SLOTS, CONSULTATION_MODE_LABELS, fetchDoctorById, formatDoctorDisplayName } from '../lib/doctors';
import { appointmentRequest } from '../lib/api';
import { patientRequest } from '../lib/patientRequest';
import { saveAppointmentVisitMode } from '../lib/telemedicine';

function getNextDays(count = 14) {
  const days = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (d.getDay() !== 0) {
      days.push(d);
    }
  }
  return days;
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function formatDisplayDate(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime12h(time24) {
  const [h, m] = time24.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`;
}

function slotMinutes(time24) {
  const [h, m] = time24.split(':').map(Number);
  return h * 60 + m;
}

function groupSlotsByPeriod(slots, bookedSet) {
  const morning = [];
  const afternoon = [];
  for (const slot of slots) {
    const mins = slotMinutes(slot);
    const entry = { slot, booked: bookedSet.has(slot) };
    if (mins < 12 * 60) morning.push(entry);
    else afternoon.push(entry);
  }
  return { morning, afternoon };
}

function StepIndicator({ step }) {
  const steps = [
    { n: 1, label: 'Date' },
    { n: 2, label: 'Time' },
    { n: 3, label: 'Confirm' }
  ];
  return (
    <div className="flex items-center gap-2 sm:gap-4">
      {steps.map((s, i) => (
        <React.Fragment key={s.n}>
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
                step >= s.n
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              )}
            >
              {step > s.n ? <CheckCircle size={16} strokeWidth={2.5} /> : s.n}
            </span>
            <span
              className={cn(
                'hidden sm:inline text-sm font-medium truncate',
                step >= s.n ? 'text-slate-900' : 'text-slate-400'
              )}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <ChevronRight size={16} className="text-slate-300 shrink-0 hidden sm:block" aria-hidden />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function BookAppointment({ patient, profileReady = true, onRetryProfile }) {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const { getToken } = useAuth();

  const [doctor, setDoctor] = useState(null);
  const [doctorLoading, setDoctorLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadDoctor = async () => {
      try {
        setDoctorLoading(true);
        const data = await fetchDoctorById(doctorId);
        if (active) {
          setDoctor(data);
        }
      } catch {
        if (active) {
          setDoctor(null);
        }
      } finally {
        if (active) {
          setDoctorLoading(false);
        }
      }
    };

    loadDoctor();
    return () => {
      active = false;
    };
  }, [doctorId]);

  useEffect(() => {
    let active = true;

    const loadReports = async () => {
      if (!profileReady) return;
      try {
        setReportsLoading(true);
        const data = await patientRequest('/reports', getToken);
        if (active) {
          setReports(Array.isArray(data.reports) ? data.reports : []);
        }
      } catch {
        if (active) {
          setReports([]);
        }
      } finally {
        if (active) {
          setReportsLoading(false);
        }
      }
    };

    loadReports();
    return () => {
      active = false;
    };
  }, [profileReady, getToken]);

  const availableDays = useMemo(() => getNextDays(14), []);

  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [visitMode, setVisitMode] = useState('in_person');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [selectedReportIds, setSelectedReportIds] = useState([]);

  const supportsTelemedicine = doctor?.consultationMode === 'both';

  /** API returns `id`; some code paths may still use `_id`. */
  const patientRecordId = useMemo(() => {
    if (!patient) return null;
    const raw = patient.id ?? patient._id;
    return raw != null && raw !== '' ? String(raw) : null;
  }, [patient]);

  const currentStep = !selectedDate ? 1 : !selectedTime ? 2 : 3;

  if (doctorLoading) {
    return (
      <Card className="border-slate-200/80 shadow-md py-20 text-center">
        <Loader2 className="w-11 h-11 text-blue-600 animate-spin mx-auto" aria-hidden />
        <p className="text-slate-700 mt-5 font-semibold text-sm">Loading doctor profile...</p>
      </Card>
    );
  }

  if (!doctor) {
    return (
      <Card className="p-0 overflow-hidden border-slate-200/80 shadow-lg">
        <div className="px-8 py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500 mb-5">
            <AlertCircle size={28} />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Provider not found</h2>
          <p className="text-slate-500 mt-2 max-w-md mx-auto text-sm leading-relaxed">
            This profile may have been removed or the link is outdated. Return to the directory to choose another clinician.
          </p>
          <Button variant="secondary" className="mt-8" onClick={() => navigate('/doctors')}>
            <ArrowLeft size={18} /> Back to directory
          </Button>
        </div>
      </Card>
    );
  }

  const doctorName = formatDoctorDisplayName(doctor.name);
  const doctorSpeciality =
    typeof doctor.speciality === 'string' && doctor.speciality.trim()
      ? doctor.speciality
      : 'General Physician';
  const doctorDegree = typeof doctor.degree === 'string' ? doctor.degree : 'MBBS';
  const doctorExperience = typeof doctor.experience === 'string' ? doctor.experience : '1 Year';
  const doctorAddress =
    typeof doctor.address === 'string'
      ? doctor.address
      : doctor.address && typeof doctor.address === 'object'
        ? Object.values(doctor.address).filter(Boolean).join(', ')
        : 'Sri Lanka';
  const doctorFees = Number.isFinite(Number(doctor.fees)) ? Number(doctor.fees) : 0;
  const doctorImage = typeof doctor.image === 'string' && doctor.image ? doctor.image : '';

  const slotsBookedMap =
    doctor.slots_booked && typeof doctor.slots_booked === 'object' && !Array.isArray(doctor.slots_booked)
      ? doctor.slots_booked
      : {};

  const bookedSlotsRaw = slotsBookedMap[selectedDate ? formatDate(selectedDate) : ''];
  const bookedSlots = Array.isArray(bookedSlotsRaw) ? bookedSlotsRaw : [];
  const bookedSet = new Set(bookedSlots);
  const { morning, afternoon } = groupSlotsByPeriod(TIME_SLOTS, bookedSet);
  const availableCount = TIME_SLOTS.filter((s) => !bookedSet.has(s)).length;

  const handleBook = async () => {
    if (!selectedDate || !selectedTime) {
      setMessage({ type: 'error', text: 'Please select a date and time slot.' });
      return;
    }

    if (!profileReady) {
      setMessage({
        type: 'error',
        text: 'Your profile is still loading. Wait a moment, then try again.'
      });
      return;
    }

    if (!patientRecordId) {
      setMessage({
        type: 'error',
        text:
          'We could not load your patient record from the server. Check the alert at the top of the page, tap Retry below, or open Profile.'
      });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await appointmentRequest('', getToken, {
        method: 'POST',
        body: {
          patientId: patientRecordId,
          doctorId: doctor._id,
          slotDate: formatDate(selectedDate),
          slotTime: selectedTime,
          amount: doctorFees,
          reason: reason.trim(),
          visitMode,
          ...(selectedReportIds.length > 0 ? { reportIds: selectedReportIds } : {})
        }
      });

      const createdAppointmentId = result?.appointment?.id || result?.appointment?._id;
      if (createdAppointmentId) {
        saveAppointmentVisitMode(createdAppointmentId, visitMode);
      }

      setMessage({ type: 'success', text: 'Your appointment is confirmed. Redirecting to payment…' });
      setTimeout(
        () =>
          navigate('/payment', {
            state: {
              appointmentId: createdAppointmentId || '',
              patientId: patientRecordId,
              doctorId: doctor._id,
              amount: doctorFees,
              appointmentDate: formatDate(selectedDate)
            }
          }),
        800
      );
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to book appointment' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <nav className="flex items-center gap-2 text-sm text-slate-500 mb-3">
            <button
              type="button"
              onClick={() => navigate('/doctors')}
              className="hover:text-blue-600 transition-colors"
            >
              Find a doctor
            </button>
            <ChevronRight size={14} className="text-slate-300 shrink-0" aria-hidden />
            <span className="text-slate-700 font-medium">Book visit</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Schedule a visit
          </h1>
          <p className="text-slate-600 mt-2 text-sm sm:text-base max-w-xl leading-relaxed">
            Choose a convenient slot. You will receive a confirmation in your appointments list. Consultation fees are shown before you confirm.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 sm:shrink-0">
          <StepIndicator step={currentStep} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate('/doctors')}
        className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors -mt-2"
      >
        <ArrowLeft size={18} /> Back to directory
      </button>

      {!profileReady && (
        <div
          className="rounded-xl border border-blue-200 bg-blue-50/90 px-4 py-3.5 flex items-start gap-3 text-sm text-blue-900"
          role="status"
          aria-live="polite"
        >
          <Loader2 size={20} className="shrink-0 mt-0.5 animate-spin text-blue-600" />
          <div>
            <p className="font-semibold">Loading your patient profile…</p>
            <p className="text-blue-800/90 mt-1 leading-relaxed">
              You can choose a date and time now. The confirm button stays disabled until your record is ready.
            </p>
          </div>
        </div>
      )}

      {profileReady && !patientRecordId && (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-4 text-sm text-red-900"
          role="alert"
        >
          <div className="flex items-start gap-3 flex-1">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Patient record unavailable</p>
              <p className="text-red-800/90 mt-1 leading-relaxed">
                The app could not reach your profile (patient service off, network error, or sign-in issue). Fix the red
                message in the header if shown, then retry.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {typeof onRetryProfile === 'function' && (
              <Button type="button" variant="secondary" className="rounded-xl" onClick={() => onRetryProfile()}>
                <RefreshCw size={18} />
                Retry profile
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              className="rounded-xl w-full sm:w-auto"
              onClick={() => navigate('/profile')}
            >
              Open profile
            </Button>
          </div>
        </div>
      )}

      {message && (
        <div
          role="alert"
          className={cn(
            'rounded-xl border px-4 py-3.5 flex items-start gap-3 text-sm',
            message.type === 'error'
              ? 'bg-red-50 text-red-800 border-red-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          )}
        >
          {message.type === 'error' ? (
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
          ) : (
            <CheckCircle size={20} className="shrink-0 mt-0.5" />
          )}
          <span className="font-medium leading-snug">{message.text}</span>
        </div>
      )}

      <Card className="p-0 overflow-hidden border-slate-200/80 shadow-lg">
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-8 sm:px-8 sm:py-10">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.03\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-90" aria-hidden />
          <div className="relative flex flex-col lg:flex-row gap-8 items-start">
            <img
              src={doctorImage}
              alt=""
              className="w-24 h-24 rounded-2xl border-2 border-white/20 object-cover shadow-xl ring-1 ring-white/10"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-teal-300/90 mb-2">
                {CONSULTATION_MODE_LABELS[doctor.consultationMode] || CONSULTATION_MODE_LABELS.in_person_only}
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{doctorName}</h2>
              <p className="text-slate-300 mt-1.5 font-medium">{doctorSpeciality}</p>
              <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 text-sm text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <Award size={15} className="text-teal-400 shrink-0" />
                  {doctorDegree}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={15} className="text-teal-400 shrink-0" />
                  {doctorExperience}
                </span>
                <span className="inline-flex items-center gap-1.5 min-w-0">
                  <MapPin size={15} className="text-teal-400 shrink-0" />
                  <span className="truncate">{doctorAddress}</span>
                </span>
              </div>
            </div>
            <div className="w-full lg:w-auto lg:min-w-[200px] rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 px-6 py-5 text-center lg:text-left">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Consultation fee</p>
              <p className="text-3xl font-bold text-white mt-2 tabular-nums">
                Rs. {doctorFees.toLocaleString()}
              </p>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Billed as shown. Payment terms follow clinic policy.
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="border-slate-200/80 shadow-md p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Calendar size={18} />
              </span>
              Select a date
            </h3>
            <p className="text-slate-500 text-sm mt-1">
              Sundays are skipped. {availableCount} time slots offered per day.
            </p>
          </div>
        </div>
        <div className="relative -mx-1">
          <div className="flex gap-2 overflow-x-auto pb-2 px-1 scrollbar-thin snap-x snap-mandatory">
            {availableDays.map((day) => {
              const dateStr = formatDate(day);
              const isSelected = selectedDate && formatDate(selectedDate) === dateStr;
              const isToday = formatDate(new Date()) === dateStr;

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => {
                    setSelectedDate(day);
                    setSelectedTime(null);
                  }}
                  className={cn(
                    'snap-start flex-shrink-0 flex flex-col items-center px-4 py-3.5 rounded-xl border transition-all duration-200 min-w-[88px]',
                    isSelected
                      ? 'border-blue-600 bg-blue-600 text-white shadow-md ring-2 ring-blue-600/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-slate-50'
                  )}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide opacity-90">
                    {day.toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                  <span className="text-2xl font-bold mt-1 tabular-nums">{day.getDate()}</span>
                  <span className="text-xs mt-0.5 opacity-80">
                    {day.toLocaleDateString('en-US', { month: 'short' })}
                  </span>
                  {isToday && (
                    <span
                      className={cn(
                        'text-[10px] font-bold mt-1.5 uppercase tracking-wide',
                        isSelected ? 'text-blue-100' : 'text-blue-600'
                      )}
                    >
                      Today
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {selectedDate && (
        <Card className="border-slate-200/80 shadow-md p-6 sm:p-8">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Clock size={18} />
              </span>
              Select a time
            </h3>
            <p className="text-slate-500 text-sm mt-1">
              Times are shown in your local timezone ·{' '}
              <span className="font-medium text-slate-700">{formatDisplayDate(selectedDate)}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-4 text-xs mb-6">
            <span className="inline-flex items-center gap-2 text-slate-600">
              <span className="h-3 w-3 rounded-sm border-2 border-slate-300 bg-white" /> Available
            </span>
            <span className="inline-flex items-center gap-2 text-slate-400">
              <span className="h-3 w-3 rounded-sm bg-slate-100 border border-slate-200" /> Unavailable
            </span>
          </div>

          {[{ label: 'Morning', items: morning }, { label: 'Afternoon', items: afternoon }].map(
            (block) =>
              block.items.length > 0 && (
                <div key={block.label} className="mb-8 last:mb-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    {block.label}
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                    {block.items.map(({ slot, booked }) => {
                      const isSelected = selectedTime === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={booked}
                          onClick={() => setSelectedTime(slot)}
                          className={cn(
                            'py-3 px-2 rounded-xl text-sm font-semibold border transition-all duration-200',
                            booked &&
                              'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed line-through decoration-slate-300',
                            isSelected &&
                              !booked &&
                              'border-blue-600 bg-blue-600 text-white shadow-md ring-2 ring-blue-600/15',
                            !isSelected &&
                              !booked &&
                              'border-slate-200 bg-white text-slate-800 hover:border-blue-400 hover:bg-blue-50/50'
                          )}
                        >
                          {formatTime12h(slot)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )
          )}
        </Card>
      )}

      {selectedDate && selectedTime && (
        <Card className="border-slate-200/80 shadow-md p-6 sm:p-8">
          <h3 className="text-lg font-semibold text-slate-900 mb-2 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Stethoscope size={18} />
            </span>
            Confirm booking
          </h3>
          <p className="text-slate-500 text-sm mb-6">
            Add a short clinical note if you wish. This helps the clinician prepare for your visit.
          </p>

          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Consultation type</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setVisitMode('in_person')}
                  className={cn(
                    'rounded-xl border px-4 py-3 text-left transition-all',
                    visitMode === 'in_person'
                      ? 'border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-600/15'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300'
                  )}
                >
                  <p className="text-sm font-semibold">In-person</p>
                  <p className="text-xs mt-1 text-slate-500">Visit at clinic location</p>
                </button>

                <button
                  type="button"
                  onClick={() => supportsTelemedicine && setVisitMode('telemedicine')}
                  disabled={!supportsTelemedicine}
                  className={cn(
                    'rounded-xl border px-4 py-3 text-left transition-all',
                    visitMode === 'telemedicine' && supportsTelemedicine
                      ? 'border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-600/15'
                      : 'border-slate-200 bg-white text-slate-700',
                    supportsTelemedicine ? 'hover:border-blue-300' : 'cursor-not-allowed opacity-55'
                  )}
                >
                  <p className="text-sm font-semibold inline-flex items-center gap-1.5">
                    <Video size={14} /> Telemedicine
                  </p>
                  <p className="text-xs mt-1 text-slate-500">
                    {supportsTelemedicine ? 'Online video consultation' : 'Not available for this doctor'}
                  </p>
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <label htmlFor="visit-reason" className="text-sm font-medium text-slate-700">
                  Reason for visit </label>
                <span className="text-xs text-slate-400 tabular-nums">{reason.length}/500</span>
              </div>
              <textarea
                id="visit-reason"
                value={reason}
                maxLength={500}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. follow-up for blood pressure, new rash, medication review…"
                rows={4}
                className="block w-full rounded-xl border border-slate-200 bg-white py-3 px-4 text-slate-900 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-blue-600/30 focus:border-blue-500 transition-all outline-none resize-none shadow-sm"
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <FileText size={18} />
                </span>
                <div>
                  <label className="text-sm font-medium text-slate-700">Reports & documents</label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Optional — attach files you uploaded from your dashboard so your clinician can review them.
                  </p>
                </div>
              </div>

              {reportsLoading ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-6 flex items-center justify-center gap-2 text-sm text-slate-600">
                  <Loader2 size={18} className="animate-spin text-blue-600" />
                  Loading your reports…
                </div>
              ) : reports.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-5 text-sm text-slate-600">
                  <p className="font-medium text-slate-700">No reports uploaded yet</p>
                  <p className="mt-1 text-slate-500 leading-relaxed">
                    Open <strong>Dashboard</strong> → <strong>Reports & Documents</strong> to upload labs or imaging,
                    then return here to attach them.
                  </p>
                </div>
              ) : (
                <ul className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {reports.map((r) => {
                    const id = r._id ? String(r._id) : '';
                    if (!id) return null;
                    const checked = selectedReportIds.includes(id);
                    return (
                      <li key={id}>
                        <label className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50/80 transition-colors">
                          <input
                            type="checkbox"
                            className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            checked={checked}
                            onChange={() => {
                              setSelectedReportIds((prev) =>
                                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                              );
                            }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="font-semibold text-slate-900 text-sm block truncate">
                              {r.title?.trim() || 'Untitled report'}
                            </span>
                            {r.fileName && (
                              <span className="text-xs text-slate-500 font-mono truncate block mt-0.5">{r.fileName}</span>
                            )}
                            {r.description?.trim() && (
                              <span className="text-xs text-slate-600 line-clamp-2 mt-1 block">{r.description}</span>
                            )}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
              {selectedReportIds.length > 0 && (
                <p className="text-xs text-slate-500 mt-2">
                  {selectedReportIds.length} report{selectedReportIds.length === 1 ? '' : 's'} selected for this visit.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 space-y-0 divide-y divide-slate-200/80">
              {[
                ['Clinician', doctorName],
                ['Specialty', doctorSpeciality],
                ['Date', formatDisplayDate(selectedDate)],
                ['Time', formatTime12h(selectedTime)],
                ['Consultation', visitMode === 'telemedicine' ? 'Telemedicine' : 'In-person'],
                ['Location', doctorAddress],
                ...(selectedReportIds.length > 0
                  ? [[`Reports shared`, `${selectedReportIds.length} document${selectedReportIds.length === 1 ? '' : 's'}`]]
                  : [])
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-3 first:pt-0 text-sm">
                  <span className="text-slate-500">{k}</span>
                  <span className="font-medium text-slate-900 text-right">{v}</span>
                </div>
              ))}
              <div className="flex justify-between items-baseline gap-4 pt-4">
                <span className="text-sm font-semibold text-slate-700">Total due</span>
                <span className="text-xl font-bold text-blue-600 tabular-nums">
                  Rs. {doctorFees.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex gap-3 rounded-xl bg-blue-50/80 border border-blue-100 px-4 py-3 text-sm text-slate-700">
              <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                You can reschedule or cancel from <strong>My appointments</strong> while the visit is still pending or
                confirmed, subject to clinic cut-off times.
              </p>
            </div>

            <Button
              onClick={handleBook}
              disabled={loading || !profileReady || !patientRecordId}
              className="w-full py-4 text-base rounded-xl"
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Confirming…
                </>
              ) : !profileReady ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Waiting for profile…
                </>
              ) : !patientRecordId ? (
                <>
                  <AlertCircle size={20} />
                  Profile required to confirm
                </>
              ) : (
                <>
                  <CheckCircle size={20} />
                  Confirm appointment — Rs. {doctorFees.toLocaleString()}
                </>
              )}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
