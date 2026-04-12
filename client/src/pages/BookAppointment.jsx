import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import {
  Clock, MapPin, Star, Calendar, ArrowLeft, CheckCircle, AlertCircle
} from 'lucide-react';
import { cn, Card, Button } from '../components/ui';
import { mockDoctors, TIME_SLOTS } from '../data/mockDoctors';
import { appointmentRequest } from '../lib/api';

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
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime12h(time24) {
  const [h, m] = time24.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`;
}

export default function BookAppointment({ patient }) {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const { getToken } = useAuth();

  const doctor = mockDoctors.find((d) => d._id === doctorId);

  const availableDays = useMemo(() => getNextDays(14), []);

  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  if (!doctor) {
    return (
      <Card className="text-center py-16">
        <AlertCircle className="mx-auto text-red-400 mb-4" size={48} />
        <p className="text-gray-700 text-lg font-medium">Doctor not found</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/doctors')}>
          <ArrowLeft size={18} /> Back to Doctors
        </Button>
      </Card>
    );
  }

  const bookedSlots = doctor.slots_booked?.[selectedDate ? formatDate(selectedDate) : ''] || [];

  const handleBook = async () => {
    if (!selectedDate || !selectedTime) {
      setMessage({ type: 'error', text: 'Please select a date and time slot.' });
      return;
    }

    if (!patient?._id) {
      setMessage({ type: 'error', text: 'Patient profile not loaded. Please go to Dashboard first and try again.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await appointmentRequest('', getToken, {
        method: 'POST',
        body: {
          patientId: patient._id,
          doctorId: doctor._id,
          slotDate: formatDate(selectedDate),
          slotTime: selectedTime,
          amount: doctor.fees,
          reason: reason.trim()
        }
      });

      setMessage({ type: 'success', text: 'Appointment booked successfully!' });
      setTimeout(() => navigate('/appointments'), 1500);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to book appointment' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/doctors')}
        className="flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors font-medium"
      >
        <ArrowLeft size={18} /> Back to Doctors
      </button>

      {message && (
        <div className={cn(
          'p-4 rounded-xl flex items-center gap-3 font-medium',
          message.type === 'error'
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        )}>
          {message.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          {message.text}
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-6">
          <img
            src={doctor.image}
            alt={doctor.name}
            className="w-20 h-20 rounded-2xl border-2 border-white/30 object-cover"
          />
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white">{doctor.name}</h2>
            <p className="text-blue-100 mt-1">{doctor.speciality} &middot; {doctor.degree}</p>
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-blue-100">
              <span className="flex items-center gap-1"><Clock size={14} /> {doctor.experience}</span>
              <span className="flex items-center gap-1"><MapPin size={14} /> {doctor.address}</span>
              <span className="flex items-center gap-1"><Star size={14} /> {doctor.degree}</span>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-6 py-4 text-center">
            <p className="text-blue-100 text-xs uppercase tracking-wider">Consultation Fee</p>
            <p className="text-3xl font-bold text-white mt-1">Rs. {doctor.fees.toLocaleString()}</p>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Calendar className="text-blue-600" /> Select Date
        </h3>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {availableDays.map((day) => {
            const dateStr = formatDate(day);
            const isSelected = selectedDate && formatDate(selectedDate) === dateStr;
            const isToday = formatDate(new Date()) === dateStr;

            return (
              <button
                key={dateStr}
                onClick={() => { setSelectedDate(day); setSelectedTime(null); }}
                className={cn(
                  'flex-shrink-0 flex flex-col items-center px-4 py-3 rounded-xl border-2 transition-all duration-200 min-w-[80px]',
                  isSelected
                    ? 'border-blue-600 bg-blue-600 text-white shadow-lg'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                )}
              >
                <span className="text-xs font-medium uppercase">
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
                <span className="text-2xl font-bold mt-1">{day.getDate()}</span>
                <span className="text-xs mt-0.5">
                  {day.toLocaleDateString('en-US', { month: 'short' })}
                </span>
                {isToday && (
                  <span className={cn(
                    'text-[10px] font-semibold mt-1',
                    isSelected ? 'text-blue-100' : 'text-blue-600'
                  )}>
                    Today
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {selectedDate && (
        <Card>
          <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Clock className="text-blue-600" /> Select Time Slot
          </h3>
          <p className="text-gray-500 text-sm mb-6">
            Available slots for {formatDisplayDate(selectedDate)}
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {TIME_SLOTS.map((slot) => {
              const isBooked = bookedSlots.includes(slot);
              const isSelected = selectedTime === slot;

              return (
                <button
                  key={slot}
                  disabled={isBooked}
                  onClick={() => setSelectedTime(slot)}
                  className={cn(
                    'py-3 px-2 rounded-xl text-sm font-semibold border-2 transition-all duration-200',
                    isBooked && 'bg-gray-100 text-gray-400 border-gray-100 cursor-not-allowed line-through',
                    isSelected && !isBooked && 'border-blue-600 bg-blue-600 text-white shadow-lg',
                    !isSelected && !isBooked && 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                  )}
                >
                  {formatTime12h(slot)}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {selectedDate && selectedTime && (
        <Card>
          <h3 className="text-xl font-bold text-gray-900 mb-4">Booking Details</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Visit (optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe your symptoms or reason for the appointment..."
                rows={3}
                className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-3 px-4 text-gray-900 focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all outline-none resize-none"
              />
            </div>

            <div className="bg-blue-50 rounded-xl p-5 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Doctor</span>
                <span className="font-semibold text-gray-900">{doctor.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Date</span>
                <span className="font-semibold text-gray-900">{formatDisplayDate(selectedDate)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Time</span>
                <span className="font-semibold text-gray-900">{formatTime12h(selectedTime)}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-blue-100">
                <span className="text-gray-600 font-medium">Total Amount</span>
                <span className="font-bold text-blue-600 text-lg">Rs. {doctor.fees.toLocaleString()}</span>
              </div>
            </div>

            <Button
              onClick={handleBook}
              disabled={loading}
              className="w-full py-4 text-base"
            >
              {loading ? (
                'Booking...'
              ) : (
                <>
                  <CheckCircle size={20} />
                  Confirm Appointment — Rs. {doctor.fees.toLocaleString()}
                </>
              )}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
