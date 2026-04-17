import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { AdminContext } from '../context/AdminContext';
import DoctorNotificationBell from '../components/DoctorNotificationBell';

const JITSI_SCRIPT_URL = 'https://meet.jit.si/external_api.js';

const newMedicationRow = () => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  drugName: '',
  dosage: '',
  frequency: '',
  duration: '',
  notes: ''
});

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

function formatDoctorDisplayName(name, fallback = 'Doctor') {
  const baseName = typeof name === 'string' && name.trim() ? name.trim() : fallback;
  if (/^dr\.?\s+/i.test(baseName)) {
    return baseName.replace(/^dr\.?\s+/i, 'Dr. ');
  }
  return `Dr. ${baseName}`;
}

const DoctorHome = () => {
  const navigate = useNavigate();
  const { setDToken, dToken, backendUrl } = useContext(AdminContext);
  const jitsiContainerRef = useRef(null);
  const jitsiApiRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [doctor, setDoctor] = useState(null);
  const [stats, setStats] = useState({
    todayAppointments: 0,
    pendingAppointments: 0,
    completedToday: 0
  });
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [activeSection, setActiveSection] = useState('overview');
  const [joiningAppointmentId, setJoiningAppointmentId] = useState('');
  const [liveAppointmentId, setLiveAppointmentId] = useState('');
  const [sessionError, setSessionError] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [detailsLoadingId, setDetailsLoadingId] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [completedAppointments, setCompletedAppointments] = useState([]);
  const [completedLoading, setCompletedLoading] = useState(false);
  const [completedError, setCompletedError] = useState('');
  const [prescriptionAppointment, setPrescriptionAppointment] = useState(null);
  const [medicationRows, setMedicationRows] = useState([newMedicationRow()]);
  const [generalInstructions, setGeneralInstructions] = useState('');
  const [existingPrescriptions, setExistingPrescriptions] = useState([]);
  const [prescriptionsLoading, setPrescriptionsLoading] = useState(false);
  const [prescriptionFormError, setPrescriptionFormError] = useState('');
  const [prescriptionFormSuccess, setPrescriptionFormSuccess] = useState('');
  const [prescriptionSubmitting, setPrescriptionSubmitting] = useState(false);

  const onLogout = () => {
    localStorage.removeItem('dToken');
    setDToken('');
    navigate('/');
  };

  const formatTime12h = (time24 = '') => {
    const [h, m] = String(time24).split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return time24 || 'N/A';
    const suffix = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
  };

  const formatDate = (dateStr = '') => {
    const date = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateStr || 'Unknown date';
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatBytes = (bytes = 0) => {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  };

  const loadDoctorHome = async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await axios.get(`${backendUrl}/api/doctor/appointments/upcoming`, {
        headers: { dtoken: dToken }
      });

      if (!data.success) {
        throw new Error(data.message || 'Failed to load doctor home');
      }

      setDoctor(data.doctor || null);
      setStats(data.stats || { todayAppointments: 0, pendingAppointments: 0, completedToday: 0 });
      setUpcomingAppointments(Array.isArray(data.upcomingAppointments) ? data.upcomingAppointments : []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load doctor home');
      setUpcomingAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!dToken) {
      setLoading(false);
      return;
    }
    loadDoctorHome();
  }, [dToken]);

  useEffect(() => {
    if (!dToken) {
      return;
    }

    loadCompletedAppointments();
  }, [dToken]);

  useEffect(() => {
    if (!dToken) {
      return undefined;
    }

    let timeoutId;

    const scheduleMidnightRefresh = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);

      timeoutId = window.setTimeout(async () => {
        await loadDoctorHome();
        await loadCompletedAppointments();
        scheduleMidnightRefresh();
      }, nextMidnight.getTime() - now.getTime());
    };

    scheduleMidnightRefresh();

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [dToken]);

  const loadCompletedAppointments = async () => {
    if (!dToken) return;
    try {
      setCompletedLoading(true);
      setCompletedError('');
      const { data } = await axios.get(`${backendUrl}/api/doctor/appointments/completed`, {
        headers: { dtoken: dToken }
      });
      if (!data.success) {
        throw new Error(data.message || 'Failed to load completed appointments');
      }
      setCompletedAppointments(Array.isArray(data.completedAppointments) ? data.completedAppointments : []);
    } catch (err) {
      setCompletedError(err.response?.data?.message || err.message || 'Failed to load completed appointments');
      setCompletedAppointments([]);
    } finally {
      setCompletedLoading(false);
    }
  };

  const loadPrescriptionsForAppointment = async (appointmentId) => {
    if (!dToken || !appointmentId) return;
    try {
      setPrescriptionsLoading(true);
      const { data } = await axios.get(`${backendUrl}/api/doctor/prescriptions`, {
        headers: { dtoken: dToken },
        params: { appointmentId }
      });
      if (!data.success) {
        throw new Error(data.message || 'Failed to load prescriptions');
      }
      setPrescriptionFormError('');
      setExistingPrescriptions(Array.isArray(data.prescriptions) ? data.prescriptions : []);
    } catch (err) {
      setExistingPrescriptions([]);
      setPrescriptionFormError(err.response?.data?.message || err.message || 'Failed to load prescriptions');
    } finally {
      setPrescriptionsLoading(false);
    }
  };

  useEffect(() => {
    if (!dToken || activeSection !== 'prescriptions') {
      return;
    }
    loadCompletedAppointments();
  }, [dToken, activeSection]);

  useEffect(() => {
    if (!prescriptionAppointment?._id || !dToken) {
      setExistingPrescriptions([]);
      return;
    }
    setPrescriptionFormError('');
    loadPrescriptionsForAppointment(prescriptionAppointment._id);
  }, [prescriptionAppointment?._id, dToken]);

  const selectPrescriptionAppointment = (apt) => {
    setPrescriptionAppointment(apt);
    setMedicationRows([newMedicationRow()]);
    setGeneralInstructions('');
    setPrescriptionFormError('');
    setPrescriptionFormSuccess('');
  };

  const updateMedicationRow = (rowId, field, value) => {
    setMedicationRows((rows) => rows.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)));
  };

  const addMedicationRow = () => {
    setMedicationRows((rows) => [...rows, newMedicationRow()]);
  };

  const removeMedicationRow = (rowId) => {
    setMedicationRows((rows) => {
      const next = rows.filter((r) => r.id !== rowId);
      return next.length ? next : [newMedicationRow()];
    });
  };

  const submitPrescription = async (e) => {
    e.preventDefault();
    if (!prescriptionAppointment?._id || !dToken) return;
    setPrescriptionFormError('');
    setPrescriptionFormSuccess('');
    try {
      setPrescriptionSubmitting(true);
      const { data } = await axios.post(
        `${backendUrl}/api/doctor/prescriptions`,
        {
          appointmentId: prescriptionAppointment._id,
          medications: medicationRows.map(({ drugName, dosage, frequency, duration, notes }) => ({
            drugName,
            dosage,
            frequency,
            duration,
            notes
          })),
          generalInstructions
        },
        { headers: { dtoken: dToken } }
      );
      if (!data.success) {
        throw new Error(data.message || 'Failed to save prescription');
      }
      setPrescriptionFormSuccess(data.message || 'Prescription saved');
      setMedicationRows([newMedicationRow()]);
      setGeneralInstructions('');
      await loadPrescriptionsForAppointment(prescriptionAppointment._id);
    } catch (err) {
      setPrescriptionFormError(err.response?.data?.message || err.message || 'Failed to save prescription');
    } finally {
      setPrescriptionSubmitting(false);
    }
  };

  const upcomingSummary = useMemo(() => {
    if (upcomingAppointments.length === 0) return 'No upcoming appointments.';
    return `${upcomingAppointments.length} upcoming appointment${upcomingAppointments.length > 1 ? 's' : ''}.`;
  }, [upcomingAppointments]);

  const analyticsAppointments = useMemo(() => {
    const merged = new Map();
    [...upcomingAppointments, ...completedAppointments].forEach((appointment) => {
      if (!appointment?._id) return;
      merged.set(String(appointment._id), appointment);
    });
    return [...merged.values()];
  }, [completedAppointments, upcomingAppointments]);

  const chartData = useMemo(() => {
    const statuses = ['pending', 'confirmed', 'completed', 'cancelled'];
    const counts = statuses.reduce((acc, status) => {
      acc[status] = analyticsAppointments.filter((item) => item.status === status).length;
      return acc;
    }, {});

    const total = statuses.reduce((sum, status) => sum + counts[status], 0);
    const segments = [];
    let start = 0;
    const colorMap = {
      pending: '#f59e0b',
      confirmed: '#3b82f6',
      completed: '#10b981',
      cancelled: '#94a3b8'
    };

    statuses.forEach((status) => {
      const share = total > 0 ? (counts[status] / total) * 100 : 0;
      const end = start + share;
      segments.push(`${colorMap[status]} ${start.toFixed(2)}% ${end.toFixed(2)}%`);
      start = end;
    });

    const byDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => ({ day, count: 0 }));
    upcomingAppointments.forEach((item) => {
      const date = new Date(`${item.slotDate}T00:00:00`);
      if (!Number.isNaN(date.getTime())) {
        byDay[date.getDay()].count += 1;
      }
    });
    const maxDayCount = Math.max(...byDay.map((d) => d.count), 1);

    return {
      statusCounts: counts,
      total,
      donutStyle: { background: `conic-gradient(${segments.join(', ')})` },
      byDay,
      maxDayCount
    };
  }, [analyticsAppointments, upcomingAppointments]);

  const todayText = useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      }),
    []
  );

  const goToSection = (sectionId) => {
    setActiveSection(sectionId);
    const section = document.getElementById(`doctor-section-${sectionId}`);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const buildRoomName = (appointment) => {
    const id = String(appointment?._id || appointment?.id || 'session');
    const safeId = id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24) || 'session';
    return `MediLink-${safeId}`;
  };

  const waitForJitsiContainer = () =>
    new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 60;

      const check = () => {
        if (jitsiContainerRef.current) {
          resolve(jitsiContainerRef.current);
          return;
        }

        attempts += 1;
        if (attempts >= maxAttempts) {
          reject(new Error('Video container is not ready'));
          return;
        }

        window.requestAnimationFrame(check);
      };

      check();
    });

  const joinTelemedicine = async (appointment) => {
    if (!appointment || appointment.visitMode !== 'telemedicine') {
      setSessionError('This appointment is in-person. Only telemedicine visits can open Jitsi.');
      return;
    }

    try {
      setJoiningAppointmentId(appointment._id);
      setSessionError('');
      await loadJitsiScript();

      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
        jitsiApiRef.current = null;
      }

      setLiveAppointmentId(appointment._id);
      goToSection('session');
      const parentNode = await waitForJitsiContainer();

      if (!parentNode || !window.JitsiMeetExternalAPI) {
        throw new Error('Video container is not ready');
      }

      jitsiApiRef.current = new window.JitsiMeetExternalAPI('meet.jit.si', {
        roomName: buildRoomName(appointment),
        parentNode,
        width: '100%',
        height: 560,
        userInfo: {
          displayName: doctor?.name ? formatDoctorDisplayName(doctor.name) : 'Doctor'
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
      setLiveAppointmentId('');
      setSessionError(err.message || 'Failed to start telemedicine session');
    } finally {
      setJoiningAppointmentId('');
    }
  };

  const viewAppointmentDetails = async (appointmentId) => {
    try {
      setDetailsLoadingId(appointmentId);
      setActionError('');
      const { data } = await axios.get(`${backendUrl}/api/doctor/appointments/${appointmentId}`, {
        headers: { dtoken: dToken }
      });
      if (!data.success) {
        throw new Error(data.message || 'Failed to load appointment details');
      }
      setSelectedAppointment(data.appointment || null);
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Failed to load appointment details');
    } finally {
      setDetailsLoadingId('');
    }
  };

  const runAppointmentAction = async (appointmentId, action) => {
    try {
      setActionLoadingId(appointmentId + action);
      setActionError('');
      setActionMessage('');
      const { data } = await axios.patch(`${backendUrl}/api/doctor/appointments/${appointmentId}/${action}`, {}, {
        headers: { dtoken: dToken }
      });

      if (!data.success) {
        throw new Error(data.message || `Failed to ${action} appointment`);
      }

      setActionMessage(data.message || `Appointment ${action}d successfully`);

      await loadDoctorHome();
      if (action === 'complete') {
        await loadCompletedAppointments();
      }
      if (selectedAppointment?._id === appointmentId) {
        const refreshed = await axios.get(`${backendUrl}/api/doctor/appointments/${appointmentId}`, {
          headers: { dtoken: dToken }
        });
        if (refreshed?.data?.success) {
          setSelectedAppointment(refreshed.data.appointment || null);
        }
      }
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || `Failed to ${action} appointment`);
    } finally {
      setActionLoadingId('');
    }
  };

  useEffect(() => {
    return () => {
      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
        jitsiApiRef.current = null;
      }
    };
  }, []);

  return (
    <div className="page-container doctor-home-page">
      <div className="doctor-dashboard-top">
        <div>
          <h2 className="page-title">Doctor Dashboard</h2>
          <p className="doctor-dashboard-subtitle">Your clinical day at a glance, with quick access to schedule insights.</p>
        </div>
        <div className="doctor-dashboard-top-actions">
          <DoctorNotificationBell />
          <div className="doctor-dashboard-date-chip">{todayText}</div>
        </div>
      </div>

      <div className="doctor-home-layout">
        <aside className="doctor-home-nav card">
          <div className="doctor-nav-head">
            <p className="doctor-nav-kicker">Workspace</p>
            <h4>Quick Navigation</h4>
            <span>Jump between dashboard sections</span>
          </div>
          <button
            type="button"
            className={`doctor-nav-item ${activeSection === 'overview' ? 'active' : ''}`}
            onClick={() => goToSection('overview')}
          >
            <span>Overview</span>
            <small>{stats.todayAppointments}</small>
          </button>
          <button
            type="button"
            className={`doctor-nav-item ${activeSection === 'analytics' ? 'active' : ''}`}
            onClick={() => goToSection('analytics')}
          >
            <span>Analytics</span>
            <small>{chartData.total}</small>
          </button>
          <button
            type="button"
            className={`doctor-nav-item ${activeSection === 'upcoming' ? 'active' : ''}`}
            onClick={() => goToSection('upcoming')}
          >
            <span>Upcoming Queue</span>
            <small>{upcomingAppointments.length}</small>
          </button>
          <button
            type="button"
            className={`doctor-nav-item ${activeSection === 'prescriptions' ? 'active' : ''}`}
            onClick={() => goToSection('prescriptions')}
          >
            <span>Prescriptions</span>
            <small>{activeSection === 'prescriptions' || completedAppointments.length > 0 ? completedAppointments.length : '—'}</small>
          </button>
        </aside>

        <div className="doctor-home-content">
          <div id="doctor-section-overview" className="doctor-home-header card doctor-home-hero">
            <div>
              <h3>
                {doctor?.name ? formatDoctorDisplayName(doctor.name) : 'Welcome Doctor'}{' '}
                <span className="doctor-hello-wave">👋</span>
              </h3>
              <p>{doctor?.speciality || 'Clinical workspace'} · Ready for today’s consultations</p>
              <small>{upcomingSummary}</small>
            </div>
            <div className="doctor-home-actions">
              <button type="button" className="cancel-btn doctor-home-btn-light" onClick={loadDoctorHome} disabled={loading}>
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
              <button type="button" className="login-btn doctor-home-btn-primary" onClick={onLogout}>
                Logout
              </button>
            </div>
          </div>

          <div className="doctor-home-stats">
            <div className="card doctor-stat-card doctor-stat-indigo">
              <p>Today Appointments</p>
              <h3>{stats.todayAppointments}</h3>
              <small>Scheduled for the current date</small>
            </div>
            <div className="card doctor-stat-card doctor-stat-amber">
              <p>Pending</p>
              <h3>{stats.pendingAppointments}</h3>
              <small>Awaiting confirmation/completion</small>
            </div>
            <div className="card doctor-stat-card doctor-stat-emerald">
              <p>Completed Today</p>
              <h3>{stats.completedToday}</h3>
              <small>Consultations closed today</small>
            </div>
          </div>

          <div id="doctor-section-analytics" className="doctor-home-charts">
            <div className="card doctor-chart-card">
              <div className="doctor-chart-header">
                <h3>Appointment Status Mix</h3>
                <p>Current appointments across every status</p>
              </div>
              <div className="doctor-donut-wrap">
                <div className="doctor-donut" style={chartData.donutStyle}>
                  <div className="doctor-donut-center">
                    <strong>{chartData.total}</strong>
                    <span>Total</span>
                  </div>
                </div>
                <ul className="doctor-legend">
                  <li><span className="dot pending"></span>Pending ({chartData.statusCounts.pending})</li>
                  <li><span className="dot confirmed"></span>Confirmed ({chartData.statusCounts.confirmed})</li>
                  <li><span className="dot completed"></span>Completed ({chartData.statusCounts.completed})</li>
                  <li><span className="dot cancelled"></span>Cancelled ({chartData.statusCounts.cancelled})</li>
                </ul>
              </div>
            </div>

            <div className="card doctor-chart-card">
              <div className="doctor-chart-header">
                <h3>Weekly Load</h3>
                <p>Upcoming appointments by weekday</p>
              </div>
              <div className="doctor-bars">
                {chartData.byDay.map((item) => (
                  <div key={item.day} className="doctor-bar-item">
                    <div
                      className="doctor-bar"
                      style={{ height: `${(item.count / chartData.maxDayCount) * 100 || 0}%` }}
                      title={`${item.day}: ${item.count}`}
                    />
                    <span>{item.day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div id="doctor-section-upcoming" className="card doctor-home-list">
        <div className="doctor-chart-header">
          <h3>Upcoming Appointments</h3>
          <p>Chronological patient queue</p>
        </div>
        {loading ? (
          <p className="text-muted">Loading appointments...</p>
        ) : error ? (
          <p className="error-text">{error}</p>
        ) : upcomingAppointments.length === 0 ? (
          <p className="text-muted">No upcoming appointments found.</p>
        ) : (
          <>
            {actionError && <p className="error-text">{actionError}</p>}
            {actionMessage && <p className="success-text">{actionMessage}</p>}
            {sessionError && !liveAppointmentId && <p className="error-text">{sessionError}</p>}
            <ul>
            {upcomingAppointments.map((apt) => (
              <li key={apt._id} className="doctor-home-appointment-item clickable" onClick={() => viewAppointmentDetails(apt._id)}>
                <div>
                  <strong>{formatTime12h(apt.slotTime)}</strong>
                  <span>{formatDate(apt.slotDate)} · Rs. {Number(apt.amount || 0).toLocaleString()}</span>
                </div>
                <div>
                  <span className={`visit-mode-chip ${apt.visitMode === 'telemedicine' ? 'telemedicine' : 'inperson'}`}>
                    {apt.visitMode === 'telemedicine' ? 'Telemedicine' : 'In-person'}
                  </span>
                  <span className={`status-chip ${apt.status}`}>{apt.status}</span>
                  <small>{apt.patientName || `Patient #${String(apt.patientId).slice(-6)}`}</small>
                  {apt.visitMode === 'telemedicine' && (
                    <button
                      type="button"
                      className="join-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        joinTelemedicine(apt);
                      }}
                      disabled={joiningAppointmentId === apt._id}
                    >
                      {joiningAppointmentId === apt._id ? 'Joining...' : 'Join Jitsi'}
                    </button>
                  )}
                  <div className="doctor-row-actions">
                    <button
                      type="button"
                      className="row-action-btn view"
                      onClick={(e) => {
                        e.stopPropagation();
                        viewAppointmentDetails(apt._id);
                      }}
                      disabled={detailsLoadingId === apt._id}
                    >
                      {detailsLoadingId === apt._id ? 'Loading...' : 'View'}
                    </button>
                    <button
                      type="button"
                      className="row-action-btn approve"
                      onClick={(e) => {
                        e.stopPropagation();
                        runAppointmentAction(apt._id, 'approve');
                      }}
                      disabled={actionLoadingId === `${apt._id}approve` || !['pending', 'confirmed'].includes(apt.status)}
                    >
                      {actionLoadingId === `${apt._id}approve` ? 'Approving...' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      className="row-action-btn approve"
                      onClick={(e) => {
                        e.stopPropagation();
                        runAppointmentAction(apt._id, 'complete');
                      }}
                      disabled={actionLoadingId === `${apt._id}complete` || apt.status !== 'confirmed'}
                    >
                      {actionLoadingId === `${apt._id}complete` ? 'Completing...' : 'Mark Completed'}
                    </button>
                    <button
                      type="button"
                      className="row-action-btn cancel"
                      onClick={(e) => {
                        e.stopPropagation();
                        runAppointmentAction(apt._id, 'cancel');
                      }}
                      disabled={actionLoadingId === `${apt._id}cancel` || !['pending', 'confirmed'].includes(apt.status)}
                    >
                      {actionLoadingId === `${apt._id}cancel` ? 'Cancelling...' : 'Cancel'}
                    </button>
                  </div>
                </div>
              </li>
            ))}
            </ul>
          </>
        )}
      </div>

          <div id="doctor-section-prescriptions" className="card doctor-home-list doctor-prescriptions-section">
            <div className="doctor-chart-header">
              <h3>Prescriptions</h3>
              <p>Completed visits — add medications and instructions for the patient record</p>
            </div>
            {completedLoading ? (
              <p className="text-muted">Loading completed appointments...</p>
            ) : completedError ? (
              <p className="error-text">{completedError}</p>
            ) : (
              <div className="doctor-prescriptions-layout">
                <div className="doctor-prescription-panel">
                  <h4>Completed appointments</h4>
                  {completedAppointments.length === 0 ? (
                    <p className="text-muted">No completed appointments yet. Mark visits as completed to prescribe here.</p>
                  ) : (
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      {completedAppointments.map((apt) => (
                        <li key={apt._id} style={{ marginBottom: 8 }}>
                          <button
                            type="button"
                            className={`doctor-prescription-item ${prescriptionAppointment?._id === apt._id ? 'selected' : ''}`}
                            onClick={() => selectPrescriptionAppointment(apt)}
                          >
                            <div>
                              <strong>{formatTime12h(apt.slotTime)}</strong>
                              <span>
                                {formatDate(apt.slotDate)} · {apt.patientName || `Patient #${String(apt.patientId).slice(-6)}`}
                              </span>
                            </div>
                            <div style={{ marginTop: 6 }}>
                              <span
                                className={`visit-mode-chip ${apt.visitMode === 'telemedicine' ? 'telemedicine' : 'inperson'}`}
                              >
                                {apt.visitMode === 'telemedicine' ? 'Telemedicine' : 'In-person'}
                              </span>
                              <span className={`status-chip ${apt.status}`} style={{ marginLeft: 8 }}>
                                {apt.status}
                              </span>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="doctor-prescription-panel doctor-prescription-form">
                  <h4>New prescription</h4>
                  {!prescriptionAppointment ? (
                    <p className="text-muted">Select a completed appointment to open the prescription form.</p>
                  ) : (
                    <form onSubmit={submitPrescription}>
                      <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: 12 }}>
                        <strong>{prescriptionAppointment.patientName || 'Patient'}</strong>
                        {' · '}
                        {formatDate(prescriptionAppointment.slotDate)} at {formatTime12h(prescriptionAppointment.slotTime)}
                      </p>
                      {prescriptionFormError && <p className="error-text">{prescriptionFormError}</p>}
                      {prescriptionFormSuccess && <p className="success-text">{prescriptionFormSuccess}</p>}
                      {medicationRows.map((row, index) => (
                        <div key={row.id} className="doctor-medication-card">
                          <div className="doctor-medication-card-head">
                            <span>Medication {index + 1}</span>
                            {medicationRows.length > 1 && (
                              <button
                                type="button"
                                className="row-action-btn cancel"
                                onClick={() => removeMedicationRow(row.id)}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <div className="doctor-medication-grid">
                            <div className="doctor-form-field">
                              <label htmlFor={`rx-drug-${row.id}`}>Drug name</label>
                              <input
                                id={`rx-drug-${row.id}`}
                                value={row.drugName}
                                onChange={(ev) => updateMedicationRow(row.id, 'drugName', ev.target.value)}
                                placeholder="e.g. Amoxicillin"
                              />
                            </div>
                            <div className="doctor-form-field">
                              <label htmlFor={`rx-dose-${row.id}`}>Dosage / strength</label>
                              <input
                                id={`rx-dose-${row.id}`}
                                value={row.dosage}
                                onChange={(ev) => updateMedicationRow(row.id, 'dosage', ev.target.value)}
                                placeholder="e.g. 500 mg"
                              />
                            </div>
                            <div className="doctor-form-field">
                              <label htmlFor={`rx-freq-${row.id}`}>Frequency</label>
                              <input
                                id={`rx-freq-${row.id}`}
                                value={row.frequency}
                                onChange={(ev) => updateMedicationRow(row.id, 'frequency', ev.target.value)}
                                placeholder="e.g. Twice daily"
                              />
                            </div>
                            <div className="doctor-form-field">
                              <label htmlFor={`rx-dur-${row.id}`}>Duration</label>
                              <input
                                id={`rx-dur-${row.id}`}
                                value={row.duration}
                                onChange={(ev) => updateMedicationRow(row.id, 'duration', ev.target.value)}
                                placeholder="e.g. 7 days"
                              />
                            </div>
                            <div className="doctor-form-field" style={{ gridColumn: '1 / -1' }}>
                              <label htmlFor={`rx-notes-${row.id}`}>Line notes (optional)</label>
                              <input
                                id={`rx-notes-${row.id}`}
                                value={row.notes}
                                onChange={(ev) => updateMedicationRow(row.id, 'notes', ev.target.value)}
                                placeholder="Take with food, etc."
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      <button type="button" className="row-action-btn view" onClick={addMedicationRow}>
                        + Add medication line
                      </button>
                      <div className="doctor-form-field" style={{ marginTop: 12 }}>
                        <label htmlFor="rx-general">General instructions</label>
                        <textarea
                          id="rx-general"
                          value={generalInstructions}
                          onChange={(ev) => setGeneralInstructions(ev.target.value)}
                          placeholder="Follow-up, lifestyle advice, or pharmacy notes"
                        />
                      </div>
                      <div className="doctor-prescription-actions">
                        <button type="submit" className="login-btn doctor-home-btn-primary" disabled={prescriptionSubmitting}>
                          {prescriptionSubmitting ? 'Saving...' : 'Save prescription'}
                        </button>
                      </div>
                      <div className="doctor-existing-rx">
                        <h5>Prescriptions on file for this visit</h5>
                        {prescriptionsLoading ? (
                          <p className="text-muted">Loading...</p>
                        ) : existingPrescriptions.length === 0 ? (
                          <p className="text-muted">None yet for this appointment.</p>
                        ) : (
                          <ul>
                            {existingPrescriptions.map((rx) => (
                              <li key={rx._id}>
                                <strong>
                                  {new Date(rx.createdAt).toLocaleString('en-US', {
                                    dateStyle: 'medium',
                                    timeStyle: 'short'
                                  })}
                                </strong>
                                <ul style={{ margin: '6px 0 0 0', paddingLeft: 18 }}>
                                  {(rx.medications || []).map((m, i) => (
                                    <li key={`${rx._id}-m-${i}`} style={{ marginBottom: 4 }}>
                                      {m.drugName}
                                      {m.dosage ? ` · ${m.dosage}` : ''}
                                      {m.frequency ? ` · ${m.frequency}` : ''}
                                      {m.duration ? ` · ${m.duration}` : ''}
                                    </li>
                                  ))}
                                </ul>
                                {rx.generalInstructions ? (
                                  <p style={{ margin: '8px 0 0 0', color: '#475569' }}>{rx.generalInstructions}</p>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>

          {liveAppointmentId && (
            <div id="doctor-section-session" className="card doctor-live-session">
              <div className="doctor-chart-header">
                <h3>Live Telemedicine Session</h3>
                <p>{`Connected room for appointment ${String(liveAppointmentId).slice(-8)}`}</p>
              </div>
              {sessionError && <p className="error-text">{sessionError}</p>}
              <div ref={jitsiContainerRef} className="doctor-jitsi-container" />
            </div>
          )}
        </div>
      </div>

      {selectedAppointment && (
        <div className="appointment-modal-overlay" onClick={() => setSelectedAppointment(null)}>
          <div className="appointment-modal card" onClick={(e) => e.stopPropagation()}>
            <div className="appointment-modal-head">
              <div className="doctor-chart-header">
                <h3>Appointment Details</h3>
                <p>Review details and manage appointment status.</p>
              </div>
              <button type="button" className="appointment-modal-close" onClick={() => setSelectedAppointment(null)}>
                ×
              </button>
            </div>
            {actionError && <p className="error-text">{actionError}</p>}
            {actionMessage && <p className="success-text">{actionMessage}</p>}
            <div className="details-grid">
              <div><strong>Appointment ID</strong><span>{selectedAppointment._id}</span></div>
              <div><strong>Patient</strong><span>{selectedAppointment.patientName || selectedAppointment.patientId}</span></div>
              <div><strong>Patient ID</strong><span>{selectedAppointment.patientId}</span></div>
              <div><strong>Date</strong><span>{formatDate(selectedAppointment.slotDate)}</span></div>
              <div><strong>Time</strong><span>{formatTime12h(selectedAppointment.slotTime)}</span></div>
              <div><strong>Visit Mode</strong><span>{selectedAppointment.visitMode === 'telemedicine' ? 'Telemedicine' : 'In-person'}</span></div>
              <div><strong>Status</strong><span className={`status-chip ${selectedAppointment.status}`}>{selectedAppointment.status}</span></div>
              <div><strong>Payment</strong><span>{selectedAppointment.paymentStatus}</span></div>
              <div><strong>Fee</strong><span>Rs. {Number(selectedAppointment.amount || 0).toLocaleString()}</span></div>
              <div><strong>Email</strong><span>{selectedAppointment.patientEmail || 'N/A'}</span></div>
              <div className="details-full"><strong>Reason</strong><span>{selectedAppointment.reason || 'No reason provided'}</span></div>
              <div className="details-full">
                <strong>Attached Reports</strong>
                {Array.isArray(selectedAppointment.reports) && selectedAppointment.reports.length > 0 ? (
                  <ul className="attached-reports-list">
                    {selectedAppointment.reports.map((report) => (
                      <li key={report.id}>
                        <div>
                          <p>{report.title || report.fileName || 'Report'}</p>
                          <small>
                            {report.fileName || 'file'} · {formatBytes(report.size)}
                          </small>
                        </div>
                        {report.fileName ? (
                          <a
                            href={`${backendUrl}/patient-uploads/reports/${encodeURIComponent(report.fileName)}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View
                          </a>
                        ) : (
                          <span className="report-link-disabled">Unavailable</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span>No reports attached to this appointment.</span>
                )}
              </div>
              <div className="details-actions">
                <button
                  type="button"
                  className="row-action-btn approve"
                  onClick={() => runAppointmentAction(selectedAppointment._id, 'approve')}
                  disabled={actionLoadingId === `${selectedAppointment._id}approve` || !['pending', 'confirmed'].includes(selectedAppointment.status)}
                >
                  {actionLoadingId === `${selectedAppointment._id}approve` ? 'Approving...' : 'Approve Appointment'}
                </button>
                <button
                  type="button"
                  className="row-action-btn approve"
                  onClick={() => runAppointmentAction(selectedAppointment._id, 'complete')}
                  disabled={actionLoadingId === `${selectedAppointment._id}complete` || selectedAppointment.status !== 'confirmed'}
                >
                  {actionLoadingId === `${selectedAppointment._id}complete` ? 'Completing...' : 'Mark as Completed'}
                </button>
                <button
                  type="button"
                  className="row-action-btn cancel"
                  onClick={() => runAppointmentAction(selectedAppointment._id, 'cancel')}
                  disabled={actionLoadingId === `${selectedAppointment._id}cancel` || !['pending', 'confirmed'].includes(selectedAppointment.status)}
                >
                  {actionLoadingId === `${selectedAppointment._id}cancel` ? 'Cancelling...' : 'Cancel Appointment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorHome;
