import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  AlertCircle,
  FileText,
  XCircle,
  Stethoscope,
  CheckCircle,
  MapPin,
  Hash,
  CalendarDays,
  ClipboardList,
  RefreshCw,
  Loader2,
  Video
} from 'lucide-react';
import { cn, Card, Button, StatusBadge } from '../components/ui';
import { mockDoctors } from '../data/mockDoctors';
import { appointmentRequest } from '../lib/api';
import { getResolvedVisitMode } from '../lib/telemedicine';

function formatTime12h(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`;
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    day: d.getDate(),
    month: d.toLocaleDateString('en-US', { month: 'short' })
  };
}

function appointmentTimestamp(apt) {
  return new Date(`${apt.slotDate}T${apt.slotTime || '00:00'}:00`).getTime();
}

function getDoctorInfo(doctorId) {
  return mockDoctors.find((d) => d._id === doctorId) || null;
}

const STATUS_FILTERS = ['all', 'pending', 'confirmed', 'completed', 'cancelled'];

function formatRef(id) {
  if (!id) return '';
  const s = String(id);
  return s.length > 10 ? `${s.slice(0, 8)}…` : s;
}

export default function MyAppointments({ patient, profileReady = true, onRetryProfile }) {
  const { getToken } = useAuth();
  const navigate = useNavigate();

  const patientRecordId = useMemo(() => {
    if (!patient) return null;
    const raw = patient.id ?? patient._id;
    return raw != null && raw !== '' ? String(raw) : null;
  }, [patient]);

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [cancellingId, setCancellingId] = useState(null);

  const fetchAppointments = async () => {
    if (!patientRecordId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await appointmentRequest(`?patientId=${encodeURIComponent(patientRecordId)}`, getToken);
      setAppointments(data.appointments || []);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to load appointments' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!profileReady) return;
    if (!patientRecordId) {
      setLoading(false);
      return;
    }
    fetchAppointments();
  }, [patientRecordId, profileReady]);

  const handleCancel = async (appointmentId) => {
    if (!window.confirm('Cancel this appointment? This action may be subject to the clinic’s cancellation policy.')) {
      return;
    }

    try {
      setCancellingId(appointmentId);
      await appointmentRequest(`/${appointmentId}/cancel`, getToken, {
        method: 'PATCH',
        body: { cancelledBy: 'patient' }
      });
      setMessage({ type: 'success', text: 'Appointment cancelled. Your list has been updated.' });
      await fetchAppointments();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to cancel appointment' });
    } finally {
      setCancellingId(null);
    }
  };

  const filtered = useMemo(
    () =>
      activeFilter === 'all' ? appointments : appointments.filter((a) => a.status === activeFilter),
    [appointments, activeFilter]
  );

  const sortedFiltered = useMemo(() => {
    const now = Date.now();
    return [...filtered].sort((a, b) => {
      const ta = appointmentTimestamp(a);
      const tb = appointmentTimestamp(b);
      const aUpcoming = ta >= now && ['pending', 'confirmed'].includes(a.status);
      const bUpcoming = tb >= now && ['pending', 'confirmed'].includes(b.status);
      if (aUpcoming && !bUpcoming) return -1;
      if (!aUpcoming && bUpcoming) return 1;
      if (aUpcoming && bUpcoming) return ta - tb;
      return tb - ta;
    });
  }, [filtered]);

  const stats = useMemo(() => {
    const now = Date.now();
    const upcoming = appointments.filter(
      (a) =>
        ['pending', 'confirmed'].includes(a.status) && appointmentTimestamp(a) >= now
    ).length;
    const completed = appointments.filter((a) => a.status === 'completed').length;
    const needsAction = appointments.filter((a) => a.status === 'pending').length;
    return { total: appointments.length, upcoming, completed, needsAction };
  }, [appointments]);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">My appointments</h1>
          <p className="text-slate-600 mt-2 text-sm sm:text-base max-w-xl leading-relaxed">
            Upcoming visits, past consultations, and cancellation options in one place—similar to a patient portal.
          </p>
        </div>
        <Link to="/doctors" className="shrink-0">
          <Button className="text-sm py-2.5 px-5 w-full sm:w-auto rounded-xl shadow-md">
            <Stethoscope size={18} /> Book a visit
          </Button>
        </Link>
      </div>

      {profileReady && patientRecordId && !loading && appointments.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: 'Total', value: stats.total, icon: CalendarDays, tone: 'slate' },
            { label: 'Upcoming', value: stats.upcoming, icon: Clock, tone: 'blue' },
            { label: 'Awaiting confirmation', value: stats.needsAction, icon: ClipboardList, tone: 'amber' },
            { label: 'Completed', value: stats.completed, icon: CheckCircle, tone: 'emerald' }
          ].map(({ label, value, icon: Icon, tone }) => (
            <div
              key={label}
              className={cn(
                'rounded-2xl border px-4 py-4 shadow-sm',
                tone === 'slate' && 'bg-white border-slate-200/80',
                tone === 'blue' && 'bg-blue-50/50 border-blue-100',
                tone === 'amber' && 'bg-amber-50/50 border-amber-100',
                tone === 'emerald' && 'bg-emerald-50/50 border-emerald-100'
              )}
            >
              <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wide">
                <Icon size={14} className="opacity-70" />
                {label}
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2 tabular-nums">{value}</p>
            </div>
          ))}
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

      {profileReady && patientRecordId && !loading && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
          {STATUS_FILTERS.map((filter) => {
            const count =
              filter === 'all'
                ? appointments.length
                : appointments.filter((a) => a.status === filter).length;
            return (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={cn(
                  'px-4 py-2.5 rounded-xl text-sm font-semibold capitalize transition-all whitespace-nowrap border',
                  activeFilter === filter
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                )}
              >
                {filter === 'all' ? 'All' : filter}
                <span
                  className={cn('ml-1.5 tabular-nums', activeFilter === filter ? 'text-slate-300' : 'text-slate-400')}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!profileReady ? (
        <Card className="border-slate-200/80 shadow-md py-20 text-center">
          <Loader2 className="w-11 h-11 text-blue-600 animate-spin mx-auto" aria-hidden />
          <p className="text-slate-700 mt-5 font-semibold text-sm">Loading your patient profile…</p>
          <p className="text-slate-500 text-xs mt-2 max-w-sm mx-auto leading-relaxed">
            Hang on while we connect your account. Your visits will load right after.
          </p>
        </Card>
      ) : !patientRecordId ? (
        <Card className="border-slate-200/80 shadow-lg p-0 overflow-hidden">
          <div className="px-8 py-16 text-center max-w-lg mx-auto">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 mb-5">
              <AlertCircle size={28} />
            </div>
            <h2 className="text-xl font-semibold text-slate-900">Patient record unavailable</h2>
            <p className="text-slate-500 mt-2 text-sm leading-relaxed">
              We could not load your chart from the server. Check the red alert at the top of the page (patient service
              or network), then retry or open Profile.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
              {typeof onRetryProfile === 'function' && (
                <Button type="button" variant="secondary" className="rounded-xl" onClick={() => onRetryProfile()}>
                  <RefreshCw size={18} />
                  Retry profile
                </Button>
              )}
              <Button type="button" className="rounded-xl w-full sm:w-auto" onClick={() => navigate('/profile')}>
                Open profile
              </Button>
            </div>
          </div>
        </Card>
      ) : loading ? (
        <Card className="border-slate-200/80 shadow-md py-20 text-center">
          <div
            className="animate-spin w-11 h-11 border-[3px] border-blue-600 border-t-transparent rounded-full mx-auto"
            aria-hidden
          />
          <p className="text-slate-600 mt-5 font-medium text-sm">Loading your schedule…</p>
          <p className="text-slate-400 text-xs mt-1">This may take a moment on slow connections.</p>
        </Card>
      ) : sortedFiltered.length === 0 ? (
        <Card className="border-slate-200/80 shadow-md py-16 px-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-5">
            <Calendar size={32} />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">
            {activeFilter === 'all' ? 'No appointments yet' : `No ${activeFilter} visits`}
          </h2>
          <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto leading-relaxed">
            When you book with a clinician, confirmations and visit details will appear here—like a hospital portal
            visit list.
          </p>
          <Link to="/doctors">
            <Button className="mt-8 rounded-xl">
              <Stethoscope size={18} /> Find a clinician
            </Button>
          </Link>
        </Card>
      ) : (
        <ul className="space-y-4 list-none p-0 m-0">
          {sortedFiltered.map((apt) => {
            const doctor = getDoctorInfo(apt.doctorId);
            const isCancellable = ['pending', 'confirmed'].includes(apt.status);
            const visitMode = getResolvedVisitMode(apt, doctor);
            const canJoinVideo = visitMode === 'telemedicine' && ['pending', 'confirmed'].includes(apt.status);
            const { weekday, day, month } = formatShortDate(apt.slotDate);
            const accent =
              apt.status === 'pending'
                ? 'from-amber-500 to-orange-500'
                : apt.status === 'confirmed'
                  ? 'from-blue-500 to-indigo-600'
                  : apt.status === 'completed'
                    ? 'from-emerald-500 to-teal-600'
                    : 'from-slate-400 to-slate-500';

            return (
              <li key={apt.id}>
                <Card className="p-0 overflow-hidden border-slate-200/80 shadow-md hover:shadow-lg transition-shadow duration-300">
                  <div className="flex flex-col sm:flex-row">
                    <div
                      className={cn(
                        'sm:w-36 flex flex-row sm:flex-col items-center justify-center gap-3 sm:gap-1 px-5 py-5 sm:py-8 text-white bg-gradient-to-br',
                        accent
                      )}
                    >
                      <span className="text-xs font-bold uppercase tracking-widest opacity-90 sm:order-1">
                        {weekday}
                      </span>
                      <span className="text-4xl font-bold tabular-nums sm:order-2 leading-none">{day}</span>
                      <span className="text-sm font-semibold opacity-90 sm:order-3">{month}</span>
                    </div>

                    <div className="flex-1 p-5 sm:p-6 min-w-0">
                      <div className="flex flex-col lg:flex-row lg:items-start gap-5 lg:justify-between">
                        <div className="flex gap-4 min-w-0">
                          {doctor ? (
                            <img
                              src={doctor.image}
                              alt=""
                              className="w-14 h-14 rounded-xl object-cover ring-1 ring-slate-200/80 shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                              <Stethoscope size={24} className="text-slate-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 gap-y-1">
                              <h3 className="font-bold text-slate-900 text-lg leading-tight">
                                {doctor?.name || 'Clinician'}
                              </h3>
                              <StatusBadge status={apt.status} />
                            </div>
                            <p className="text-slate-600 text-sm font-medium mt-0.5">
                              {doctor?.speciality || 'Medical specialty'}
                            </p>
                            <p className="text-xs mt-2">
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold border',
                                  visitMode === 'telemedicine'
                                    ? 'bg-sky-50 text-sky-700 border-sky-100'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                )}
                              >
                                {visitMode === 'telemedicine' ? <Video size={12} /> : <MapPin size={12} />}
                                {visitMode === 'telemedicine' ? 'Telemedicine' : 'In-person'}
                              </span>
                            </p>
                            {doctor?.address && (
                              <p className="text-slate-500 text-xs mt-2 flex items-center gap-1.5">
                                <MapPin size={12} className="shrink-0" />
                                {doctor.address}
                              </p>
                            )}
                            {apt.reason && (
                              <p className="text-slate-500 text-sm mt-3 flex items-start gap-2 leading-relaxed border-l-2 border-slate-200 pl-3">
                                <FileText size={14} className="text-slate-400 shrink-0 mt-0.5" />
                                <span>{apt.reason}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-stretch lg:items-end gap-3 shrink-0">
                          <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 text-left lg:text-right">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Visit time</p>
                            <p className="text-lg font-bold text-slate-900 tabular-nums mt-0.5">
                              {formatTime12h(apt.slotTime)}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">{formatDisplayDate(apt.slotDate)}</p>
                          </div>
                          <div className="flex items-center justify-between lg:justify-end gap-4">
                            <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                              <Hash size={12} />
                              {formatRef(apt.id)}
                            </span>
                            <span className="text-lg font-bold text-slate-900 tabular-nums">
                              Rs. {apt.amount?.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {isCancellable && (
                        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                            Need to change plans? Cancel here if your clinic allows patient-side cancellation for this
                            visit.
                          </p>
                          <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                            {canJoinVideo && (
                              <Link to={`/appointments/${apt.id}/telemedicine`}>
                                <button
                                  type="button"
                                  className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-blue-700 hover:text-white hover:bg-blue-700 border border-blue-200 hover:border-blue-700 px-4 py-2.5 rounded-xl transition-colors shrink-0"
                                >
                                  <Video size={16} />
                                  Join video
                                </button>
                              </Link>
                            )}
                            <button
                              type="button"
                              onClick={() => handleCancel(apt.id)}
                              disabled={cancellingId === apt.id}
                              className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-red-600 hover:text-white hover:bg-red-600 border border-red-200 hover:border-red-600 px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 shrink-0"
                            >
                              <XCircle size={16} />
                              {cancellingId === apt.id ? 'Cancelling…' : 'Cancel visit'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
