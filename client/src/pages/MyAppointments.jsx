import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import {
  Calendar, Clock, AlertCircle, FileText, XCircle, Stethoscope
} from 'lucide-react';
import { cn, Card, Button, StatusBadge } from '../components/ui';
import { mockDoctors } from '../data/mockDoctors';
import { appointmentRequest } from '../lib/api';

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

function getDoctorInfo(doctorId) {
  return mockDoctors.find((d) => d._id === doctorId) || null;
}

const STATUS_FILTERS = ['all', 'pending', 'confirmed', 'completed', 'cancelled'];

export default function MyAppointments({ patient }) {
  const { getToken } = useAuth();

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [cancellingId, setCancellingId] = useState(null);

  const fetchAppointments = async () => {
    if (!patient?._id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await appointmentRequest(
        `?patientId=${patient._id}`,
        getToken
      );
      setAppointments(data.appointments || []);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to load appointments' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [patient?._id]);

  const handleCancel = async (appointmentId) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;

    try {
      setCancellingId(appointmentId);
      await appointmentRequest(
        `/${appointmentId}/cancel`,
        getToken,
        {
          method: 'PATCH',
          body: { cancelledBy: 'patient' }
        }
      );
      setMessage({ type: 'success', text: 'Appointment cancelled successfully' });
      await fetchAppointments();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to cancel appointment' });
    } finally {
      setCancellingId(null);
    }
  };

  const filtered = activeFilter === 'all'
    ? appointments
    : appointments.filter((a) => a.status === activeFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">My Appointments</h2>
          <p className="text-gray-500 mt-1">View and manage your upcoming visits</p>
        </div>
        <Link to="/doctors">
          <Button className="text-sm py-2.5 px-5">
            <Stethoscope size={18} /> Book New
          </Button>
        </Link>
      </div>

      {message && (
        <div className={cn(
          'p-4 rounded-xl flex items-center gap-3 font-medium',
          message.type === 'error'
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        )}>
          <AlertCircle size={20} />
          {message.text}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all whitespace-nowrap',
              activeFilter === filter
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            )}
          >
            {filter}
            {filter !== 'all' && (
              <span className="ml-1.5 opacity-70">
                ({appointments.filter((a) => a.status === filter).length})
              </span>
            )}
            {filter === 'all' && (
              <span className="ml-1.5 opacity-70">({appointments.length})</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <Card className="text-center py-16">
          <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
          <p className="text-gray-500 mt-4 font-medium">Loading appointments...</p>
        </Card>
      ) : !patient?._id ? (
        <Card className="text-center py-16">
          <AlertCircle className="mx-auto text-amber-400 mb-4" size={48} />
          <p className="text-gray-700 font-medium">Patient profile not loaded.</p>
          <p className="text-gray-500 text-sm mt-1">Please visit the Dashboard first so your profile can be set up.</p>
          <Link to="/dashboard">
            <Button className="mt-4">Go to Dashboard</Button>
          </Link>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-16">
          <Calendar className="mx-auto text-gray-300 mb-4" size={56} />
          <p className="text-gray-500 text-lg font-medium">
            {activeFilter === 'all'
              ? 'No appointments yet.'
              : `No ${activeFilter} appointments.`}
          </p>
          <p className="text-gray-400 mt-1">Book your first appointment with a doctor.</p>
          <Link to="/doctors">
            <Button className="mt-6">
              <Stethoscope size={18} /> Find a Doctor
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((apt) => {
            const doctor = getDoctorInfo(apt.doctorId);
            const isCancellable = ['pending', 'confirmed'].includes(apt.status);

            return (
              <Card key={apt.id} className="p-0 overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  <div className={cn(
                    'w-full md:w-2 flex-shrink-0',
                    apt.status === 'pending' && 'bg-amber-400',
                    apt.status === 'confirmed' && 'bg-blue-500',
                    apt.status === 'completed' && 'bg-emerald-500',
                    apt.status === 'cancelled' && 'bg-red-400'
                  )} />

                  <div className="flex-1 p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="flex items-start gap-4">
                        {doctor ? (
                          <img
                            src={doctor.image}
                            alt={doctor.name}
                            className="w-14 h-14 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center">
                            <Stethoscope size={24} className="text-gray-400" />
                          </div>
                        )}
                        <div>
                          <h3 className="font-bold text-gray-900 text-lg">
                            {doctor?.name || 'Doctor'}
                          </h3>
                          <p className="text-gray-500 text-sm">
                            {doctor?.speciality || 'Specialist'}
                          </p>
                          {apt.reason && (
                            <p className="text-gray-400 text-sm mt-1 flex items-center gap-1">
                              <FileText size={12} /> {apt.reason}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <StatusBadge status={apt.status} />
                        <span className="text-xl font-bold text-gray-900">
                          Rs. {apt.amount?.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-gray-100">
                      <span className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg">
                        <Calendar size={14} className="text-blue-600" />
                        {formatDisplayDate(apt.slotDate)}
                      </span>
                      <span className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg">
                        <Clock size={14} className="text-blue-600" />
                        {formatTime12h(apt.slotTime)}
                      </span>

                      {isCancellable && (
                        <button
                          onClick={() => handleCancel(apt.id)}
                          disabled={cancellingId === apt.id}
                          className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <XCircle size={16} />
                          {cancellingId === apt.id ? 'Cancelling...' : 'Cancel'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
