import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { AdminContext } from '../context/AdminContext';
import DoctorNotificationBell from '../components/DoctorNotificationBell';

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

function formatDoctorDisplayName(name, fallback = 'Doctor') {
  const baseName = typeof name === 'string' && name.trim() ? name.trim() : fallback;
  if (/^dr\.?\s+/i.test(baseName)) {
    return baseName.replace(/^dr\.?\s+/i, 'Dr. ');
  }
  return `Dr. ${baseName}`;
}

function appointmentRecordId(appointment) {
  return String(appointment?._id || appointment?.id || '');
}

const emptyMedicationRow = () => ({
  drugName: '',
  dosage: '',
  frequency: '',
  duration: '',
  notes: ''
});

const DoctorHome = () => {
  const { backendUrl, getDoctorAuthHeaders, logout, isDoctorUser, dToken } = useContext(AdminContext);
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
  const [rxSelectedId, setRxSelectedId] = useState('');
  const [rxMedications, setRxMedications] = useState([emptyMedicationRow()]);
  const [rxGeneralInstructions, setRxGeneralInstructions] = useState('');
  const [rxExisting, setRxExisting] = useState([]);
  const [rxLoading, setRxLoading] = useState(false);
  const [rxSaving, setRxSaving] = useState(false);
  const [rxError, setRxError] = useState('');
  const [rxSuccess, setRxSuccess] = useState('');

  const onLogout = () => {
    logout();
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
      const headers = await getDoctorAuthHeaders();
      const [{ data }, { data: completedPayload }] = await Promise.all([
        axios.get(`${backendUrl}/api/doctor/appointments/upcoming`, { headers }),
        axios.get(`${backendUrl}/api/doctor/appointments/completed`, { headers })
      ]);

      if (!data.success) {
        throw new Error(data.message || 'Failed to load doctor home');
      }

      setDoctor(data.doctor || null);
      setStats(data.stats || { todayAppointments: 0, pendingAppointments: 0, completedToday: 0 });
      setUpcomingAppointments(Array.isArray(data.upcomingAppointments) ? data.upcomingAppointments : []);
      if (completedPayload?.success) {
        setCompletedAppointments(
          Array.isArray(completedPayload.completedAppointments) ? completedPayload.completedAppointments : []
        );
      } else {
        setCompletedAppointments([]);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load doctor home');
      setUpcomingAppointments([]);
      setCompletedAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isDoctorUser) {
      setLoading(false);
      return;
    }
    loadDoctorHome();
  }, [isDoctorUser, getDoctorAuthHeaders, backendUrl]);

  useEffect(() => {
    if (!rxSelectedId || !isDoctorUser) {
      setRxExisting([]);
      return;
    }

    let cancelled = false;
    setRxMedications([emptyMedicationRow()]);
    setRxGeneralInstructions('');
    setRxError('');
    setRxSuccess('');

    (async () => {
      setRxLoading(true);
      try {
        const headers = await getDoctorAuthHeaders();
        const { data } = await axios.get(`${backendUrl}/api/doctor/prescriptions`, {
          headers,
          params: { appointmentId: rxSelectedId }
        });
        if (!cancelled && data?.success) {
          setRxExisting(data.prescriptions || []);
        }
      } catch {
        if (!cancelled) setRxExisting([]);
      } finally {
        if (!cancelled) setRxLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rxSelectedId, isDoctorUser, backendUrl, getDoctorAuthHeaders]);

  const upcomingSummary = useMemo(() => {
    if (upcomingAppointments.length === 0) return 'No upcoming appointments.';
    return `${upcomingAppointments.length} upcoming appointment${upcomingAppointments.length > 1 ? 's' : ''}.`;
  }, [upcomingAppointments]);

  const chartData = useMemo(() => {
    const statuses = ['pending', 'confirmed', 'completed', 'cancelled'];
    const counts = statuses.reduce((acc, status) => {
      acc[status] = upcomingAppointments.filter((item) => item.status === status).length;
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
  }, [upcomingAppointments]);

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
    const id = appointmentRecordId(appointment) || 'session';
    const safeId = id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24) || 'session';
    return `MediLink-${safeId}`;
  };

  const updateRxMedicationRow = (index, field, value) => {
    setRxMedications((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const addRxMedicationRow = () => {
    setRxMedications((rows) => [...rows, emptyMedicationRow()]);
  };

  const removeRxMedicationRow = (index) => {
    setRxMedications((rows) => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== index)));
  };

  const submitPrescription = async () => {
    if (!rxSelectedId) {
      setRxError('Select a completed appointment first.');
      return;
    }
    setRxSaving(true);
    setRxError('');
    setRxSuccess('');
    try {
      const headers = await getDoctorAuthHeaders();
      const { data } = await axios.post(
        `${backendUrl}/api/doctor/prescriptions`,
        {
          appointmentId: rxSelectedId,
          medications: rxMedications,
          generalInstructions: rxGeneralInstructions
        },
        { headers: { ...headers, 'Content-Type': 'application/json' } }
      );
      if (!data.success) {
        throw new Error(data.message || 'Failed to save prescription');
      }
      setRxSuccess('Prescription saved. The patient will see it in their portal.');
      setRxMedications([emptyMedicationRow()]);
      setRxGeneralInstructions('');
      const list = await axios.get(`${backendUrl}/api/doctor/prescriptions`, {
        headers,
        params: { appointmentId: rxSelectedId }
      });
      if (list.data?.success) {
        setRxExisting(list.data.prescriptions || []);
      }
    } catch (err) {
      setRxError(err.response?.data?.message || err.message || 'Failed to save prescription');
    } finally {
      setRxSaving(false);
    }
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
      setJoiningAppointmentId(appointmentRecordId(appointment));
      setSessionError('');
      await loadJitsiScript();

      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
        jitsiApiRef.current = null;
      }

      setLiveAppointmentId(appointmentRecordId(appointment));
      goToSection('session');
      const parentNode = await waitForJitsiContainer();

      if (!parentNode || !window.JitsiMeetExternalAPI) {
        throw new Error('Video container is not ready');
      }

      const roomName = buildRoomName(appointment);
      const displayName = doctor?.name ? formatDoctorDisplayName(doctor.name) : 'Doctor';

      const { data } = await axios.post(
        `${import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:8000'}/api/telemedicine/token`,
        {
          roomName,
          userName: displayName,
          email: doctor?.email || '',
          isModerator: true
        },
        { headers: { dtoken: dToken } }
      );

      const token = data?.token;
      console.log("Secure JWT fetched from backend:", token); // Demonstrates backend authorization successful

      jitsiApiRef.current = new window.JitsiMeetExternalAPI('meet.jit.si', {
        roomName,
        parentNode,
        width: '100%',
        height: 560,
        userInfo: {
          displayName,
          email: doctor?.email || ''
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
      const headers = await getDoctorAuthHeaders();
      const { data } = await axios.get(`${backendUrl}/api/doctor/appointments/${appointmentId}`, {
        headers
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
      const headers = await getDoctorAuthHeaders();
      const { data } = await axios.patch(`${backendUrl}/api/doctor/appointments/${appointmentId}/${action}`, {}, {
        headers
      });

      if (!data.success) {
        throw new Error(data.message || `Failed to ${action} appointment`);
      }

      setActionMessage(data.message || `Appointment ${action}d successfully`);

      await loadDoctorHome();
      if (appointmentRecordId(selectedAppointment) === String(appointmentId)) {
        const refreshed = await axios.get(`${backendUrl}/api/doctor/appointments/${appointmentId}`, {
          headers
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
            <small>{completedAppointments.length}</small>
          </button>
        </aside>

        <div className="doctor-home-content">
          <div id="doctor-section-overview" className="doctor-home-header card doctor-home-hero">
            <div>
              <h3>
                {doctor?.name ? formatDoctorDisplayName(doctor.name) : 'Welcome Doctor'}{' '}
                <span className="doctor-hello-wave">≡ƒæï</span>
              </h3>
              <p>{doctor?.speciality || 'Clinical workspace'} ┬╖ Ready for todayΓÇÖs consultations</p>
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
                <h3>Status Mix</h3>
                <p>Upcoming appointment distribution</p>
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
                  {upcomingAppointments.map((apt) => {
                    const aid = appointmentRecordId(apt);
                    return (
                    <li key={aid} className="doctor-home-appointment-item clickable" onClick={() => viewAppointmentDetails(aid)}>
                      <div>
                        <strong>{formatTime12h(apt.slotTime)}</strong>
                        <span>{formatDate(apt.slotDate)} ┬╖ Rs. {Number(apt.amount || 0).toLocaleString()}</span>
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
                            disabled={joiningAppointmentId === aid}
                          >
                            {joiningAppointmentId === aid ? 'Joining...' : 'Join Jitsi'}
                          </button>
                        )}
                        <div className="doctor-row-actions">
                          <button
                            type="button"
                            className="row-action-btn view"
                            onClick={(e) => {
                              e.stopPropagation();
                              viewAppointmentDetails(aid);
                            }}
                            disabled={detailsLoadingId === aid}
                          >
                            {detailsLoadingId === aid ? 'Loading...' : 'View'}
                          </button>
                          <button
                            type="button"
                            className="row-action-btn approve"
                            onClick={(e) => {
                              e.stopPropagation();
                              runAppointmentAction(aid, 'approve');
                            }}
                            disabled={actionLoadingId === `${aid}approve` || !['pending', 'confirmed'].includes(apt.status)}
                          >
                            {actionLoadingId === `${aid}approve` ? 'Approving...' : 'Approve'}
                          </button>
                          <button
                            type="button"
                            className="row-action-btn approve"
                            onClick={(e) => {
                              e.stopPropagation();
                              runAppointmentAction(aid, 'complete');
                            }}
                            disabled={actionLoadingId === `${aid}complete` || apt.status !== 'confirmed'}
                          >
                            {actionLoadingId === `${aid}complete` ? 'Completing...' : 'Mark Completed'}
                          </button>
                          <button
                            type="button"
                            className="row-action-btn cancel"
                            onClick={(e) => {
                              e.stopPropagation();
                              runAppointmentAction(aid, 'cancel');
                            }}
                            disabled={actionLoadingId === `${aid}cancel` || !['pending', 'confirmed'].includes(apt.status)}
                          >
                            {actionLoadingId === `${aid}cancel` ? 'Cancelling...' : 'Cancel'}
                          </button>
                        </div>
                      </div>
                    </li>
                  );})}
                </ul>
              </>
            )}
          </div>

          <div id="doctor-section-prescriptions" className="card doctor-home-list doctor-prescriptions-section">
            <div className="doctor-chart-header">
              <h3>Prescriptions</h3>
              <p>Issue medications for visits you have marked as completed.</p>
            </div>
            {loading ? (
              <p className="text-muted">Loading appointments...</p>
            ) : completedAppointments.length === 0 ? (
              <p className="text-muted">
                No completed appointments yet. Mark a visit as completed in the queue, then return here to add a prescription.
              </p>
            ) : (
              <div className="doctor-prescriptions-layout">
                <div className="doctor-prescription-panel">
                  <h4>Completed visits</h4>
                  {completedAppointments.map((apt) => {
                    const aid = appointmentRecordId(apt);
                    return (
                      <button
                        key={aid}
                        type="button"
                        className={`doctor-prescription-item ${rxSelectedId === aid ? 'selected' : ''}`}
                        onClick={() => setRxSelectedId(aid)}
                      >
                        <strong>
                          {formatDate(apt.slotDate)} · {formatTime12h(apt.slotTime)}
                        </strong>
                        <small>{apt.patientName || `Patient #${String(apt.patientId).slice(-6)}`}</small>
                      </button>
                    );
                  })}
                </div>
                <div className="doctor-prescription-panel">
                  {!rxSelectedId ? (
                    <p className="text-muted">Choose a completed appointment on the left.</p>
                  ) : (
                    <>
                      {rxLoading && <p className="text-muted">Loading existing prescriptions...</p>}
                      {rxError && <p className="error-text">{rxError}</p>}
                      {rxSuccess && <p className="success-text">{rxSuccess}</p>}
                      <form
                        className="doctor-prescription-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          submitPrescription();
                        }}
                      >
                        {rxMedications.map((med, idx) => (
                          <div key={`med-${idx}`} className="doctor-medication-card">
                            <div className="doctor-medication-card-head">
                              <span>Medication {idx + 1}</span>
                              {rxMedications.length > 1 && (
                                <button
                                  type="button"
                                  className="row-action-btn cancel"
                                  onClick={() => removeRxMedicationRow(idx)}
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                            <div className="doctor-medication-grid">
                              <div className="doctor-form-field">
                                <label htmlFor={`rx-drug-${idx}`}>Drug name</label>
                                <input
                                  id={`rx-drug-${idx}`}
                                  value={med.drugName}
                                  onChange={(e) => updateRxMedicationRow(idx, 'drugName', e.target.value)}
                                  placeholder="e.g. Amoxicillin"
                                  required
                                />
                              </div>
                              <div className="doctor-form-field">
                                <label htmlFor={`rx-dosage-${idx}`}>Dosage</label>
                                <input
                                  id={`rx-dosage-${idx}`}
                                  value={med.dosage}
                                  onChange={(e) => updateRxMedicationRow(idx, 'dosage', e.target.value)}
                                  placeholder="e.g. 500 mg"
                                />
                              </div>
                              <div className="doctor-form-field">
                                <label htmlFor={`rx-freq-${idx}`}>Frequency</label>
                                <input
                                  id={`rx-freq-${idx}`}
                                  value={med.frequency}
                                  onChange={(e) => updateRxMedicationRow(idx, 'frequency', e.target.value)}
                                  placeholder="e.g. Twice daily"
                                />
                              </div>
                              <div className="doctor-form-field">
                                <label htmlFor={`rx-dur-${idx}`}>Duration</label>
                                <input
                                  id={`rx-dur-${idx}`}
                                  value={med.duration}
                                  onChange={(e) => updateRxMedicationRow(idx, 'duration', e.target.value)}
                                  placeholder="e.g. 7 days"
                                />
                              </div>
                              <div className="doctor-form-field doctor-medication-notes-field">
                                <label htmlFor={`rx-notes-${idx}`}>Notes</label>
                                <input
                                  id={`rx-notes-${idx}`}
                                  value={med.notes}
                                  onChange={(e) => updateRxMedicationRow(idx, 'notes', e.target.value)}
                                  placeholder="Optional instructions for this drug"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        <button type="button" className="cancel-btn doctor-home-btn-light" onClick={addRxMedicationRow}>
                          Add another medication
                        </button>
                        <div className="doctor-form-field doctor-rx-general-field">
                          <label htmlFor="rx-general">General instructions</label>
                          <textarea
                            id="rx-general"
                            value={rxGeneralInstructions}
                            onChange={(e) => setRxGeneralInstructions(e.target.value)}
                            placeholder="Food, follow-up, warnings..."
                          />
                        </div>
                        <div className="doctor-prescription-actions">
                          <button type="submit" className="login-btn" disabled={rxSaving}>
                            {rxSaving ? 'Saving...' : 'Save prescription'}
                          </button>
                        </div>
                      </form>
                      {rxExisting.length > 0 && (
                        <div className="doctor-existing-rx">
                          <h5>Already issued for this visit</h5>
                          <ul>
                            {rxExisting.map((rx) => (
                              <li key={rx._id}>
                                <strong>{new Date(rx.createdAt).toLocaleString()}</strong>
                                <ul className="doctor-existing-rx-medlist">
                                  {(rx.medications || []).map((m, mi) => (
                                    <li key={`${rx._id}-m-${mi}`}>
                                      {m.drugName}
                                      {m.dosage ? ` · ${m.dosage}` : ''}
                                      {m.frequency ? ` · ${m.frequency}` : ''}
                                      {m.duration ? ` · ${m.duration}` : ''}
                                    </li>
                                  ))}
                                </ul>
                                {rx.generalInstructions ? (
                                  <p className="doctor-existing-rx-instructions">{rx.generalInstructions}</p>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
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
                ├ù
              </button>
            </div>
            {actionError && <p className="error-text">{actionError}</p>}
            {actionMessage && <p className="success-text">{actionMessage}</p>}
            <div className="details-grid">
              <div><strong>Appointment ID</strong><span>{appointmentRecordId(selectedAppointment)}</span></div>
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
                            {report.fileName || 'file'} ┬╖ {formatBytes(report.size)}
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
                  onClick={() => runAppointmentAction(appointmentRecordId(selectedAppointment), 'approve')}
                  disabled={actionLoadingId === `${appointmentRecordId(selectedAppointment)}approve` || !['pending', 'confirmed'].includes(selectedAppointment.status)}
                >
                  {actionLoadingId === `${appointmentRecordId(selectedAppointment)}approve` ? 'Approving...' : 'Approve Appointment'}
                </button>
                <button
                  type="button"
                  className="row-action-btn approve"
                  onClick={() => runAppointmentAction(appointmentRecordId(selectedAppointment), 'complete')}
                  disabled={actionLoadingId === `${appointmentRecordId(selectedAppointment)}complete` || selectedAppointment.status !== 'confirmed'}
                >
                  {actionLoadingId === `${appointmentRecordId(selectedAppointment)}complete` ? 'Completing...' : 'Mark Completed'}
                </button>
                <button
                  type="button"
                  className="row-action-btn cancel"
                  onClick={() => runAppointmentAction(appointmentRecordId(selectedAppointment), 'cancel')}
                  disabled={actionLoadingId === `${appointmentRecordId(selectedAppointment)}cancel` || !['pending', 'confirmed'].includes(selectedAppointment.status)}
                >
                  {actionLoadingId === `${appointmentRecordId(selectedAppointment)}cancel` ? 'Cancelling...' : 'Cancel Appointment'}
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

