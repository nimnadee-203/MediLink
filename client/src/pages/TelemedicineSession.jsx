import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';
import { AlertCircle, ArrowLeft, Loader2, Video } from 'lucide-react';
import { Card, Button } from '../components/ui';
import { appointmentRequest } from '../lib/api';
import { mockDoctors } from '../data/mockDoctors';
import { buildMockRoomName, getResolvedVisitMode } from '../lib/telemedicine';

const JITSI_SCRIPT_URL = 'https://meet.jit.si/external_api.js';

function loadJitsiScript() {
  return new Promise((resolve, reject) => {
    if (window.JitsiMeetExternalAPI) {
      resolve();
      return;
    }

    const existingScript = document.querySelector(`script[src=\"${JITSI_SCRIPT_URL}\"]`);
    if (existingScript) {
      existingScript.addEventListener('load', resolve, { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Jitsi script')), {
        once: true
      });
      return;
    }

    const script = document.createElement('script');
    script.src = JITSI_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Jitsi script'));
    document.body.appendChild(script);
  });
}

export default function TelemedicineSession() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { user } = useUser();
  const jitsiContainerRef = useRef(null);
  const jitsiApiRef = useRef(null);

  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  const doctor = useMemo(() => {
    if (!appointment) return null;
    return mockDoctors.find((d) => d._id === appointment.doctorId) || null;
  }, [appointment]);

  const visitMode = useMemo(
    () => getResolvedVisitMode(appointment, doctor),
    [appointment, doctor]
  );

  const roomName = useMemo(() => buildMockRoomName(appointment), [appointment]);

  useEffect(() => {
    const run = async () => {
      if (!appointmentId) {
        setError('Missing appointment id');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');
        const data = await appointmentRequest(`/${appointmentId}`, getToken);
        setAppointment(data.appointment || null);
      } catch (err) {
        setError(err.message || 'Failed to load appointment');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [appointmentId, getToken]);

  useEffect(() => {
    return () => {
      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
        jitsiApiRef.current = null;
      }
    };
  }, []);

  const joinSession = async () => {
    if (!appointment) return;
    if (visitMode !== 'telemedicine') {
      setError('This appointment is not marked as telemedicine.');
      return;
    }

    try {
      setJoining(true);
      setError('');
      await loadJitsiScript();

      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
        jitsiApiRef.current = null;
      }

      if (!jitsiContainerRef.current || !window.JitsiMeetExternalAPI) {
        throw new Error('Video container is not ready');
      }

      const displayName =
        user?.fullName ||
        [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
        'Patient';

      jitsiApiRef.current = new window.JitsiMeetExternalAPI('meet.jit.si', {
        roomName,
        parentNode: jitsiContainerRef.current,
        width: '100%',
        height: 560,
        userInfo: {
          displayName
        },
        configOverwrite: {
          prejoinPageEnabled: true,
          startWithAudioMuted: true
        },
        interfaceConfigOverwrite: {
          MOBILE_APP_PROMO: false
        }
      });
    } catch (err) {
      setError(err.message || 'Failed to start telemedicine session');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-slate-200/80 shadow-md py-20 text-center">
        <Loader2 className="w-11 h-11 text-blue-600 animate-spin mx-auto" aria-hidden />
        <p className="text-slate-700 mt-5 font-semibold text-sm">Loading telemedicine session...</p>
      </Card>
    );
  }

  if (!appointment) {
    return (
      <Card className="p-8 text-center border-slate-200/80 shadow-md">
        <AlertCircle className="mx-auto text-red-500" size={28} />
        <h2 className="text-lg font-semibold text-slate-900 mt-4">Appointment not found</h2>
        <p className="text-slate-500 mt-2">Check your appointments list and try again.</p>
        <Button className="mt-6" onClick={() => navigate('/appointments')}>
          Back to appointments
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link to="/appointments" className="text-sm text-slate-600 hover:text-blue-600 inline-flex items-center gap-2">
          <ArrowLeft size={16} /> Back to appointments
        </Link>
        <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold px-3 py-1.5">
          Mock Jitsi Session
        </span>
      </div>

      <Card className="border-slate-200/80 shadow-md p-6">
        <h1 className="text-2xl font-bold text-slate-900">Telemedicine Consultation</h1>
        <p className="text-slate-600 mt-2 text-sm">
          Doctor: <strong>{doctor?.name || 'Clinician'}</strong> | Date: <strong>{appointment.slotDate}</strong> | Time: <strong>{appointment.slotTime}</strong>
        </p>
        <p className="text-slate-500 text-xs mt-2">Room: {roomName}</p>

        {visitMode !== 'telemedicine' && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
            This appointment is currently marked as in-person. Choose telemedicine during booking to enable video visit.
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm inline-flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-5">
          <Button onClick={joinSession} disabled={joining || visitMode !== 'telemedicine'} className="rounded-xl px-6">
            {joining ? <Loader2 size={18} className="animate-spin" /> : <Video size={18} />}
            {joining ? 'Starting video...' : 'Join video consultation'}
          </Button>
        </div>
      </Card>

      <Card className="border-slate-200/80 shadow-md p-0 overflow-hidden">
        <div ref={jitsiContainerRef} className="w-full min-h-[560px] bg-slate-900" />
      </Card>
    </div>
  );
}
