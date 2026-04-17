import React, { Suspense, useEffect, useMemo, useState } from 'react';
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate
} from 'react-router-dom';
import {
  Activity,
  User,
  UploadCloud,
  FileText,
  Home,
  Shield,
  Users,
  Stethoscope,
  Settings,
  LogOut,
  Smartphone,
  MapPin,
  Calendar,
  AlertCircle,
  Clock,
  RefreshCw,
  Video
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SignIn, SignUp, SignedIn, SignedOut, useAuth, useClerk, useUser } from '@clerk/clerk-react';
import DoctorsList from './pages/DoctorsList';
import BookAppointment from './pages/BookAppointment';
import MyAppointments from './pages/MyAppointments';
import TelemedicineSession from './pages/TelemedicineSession';
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import SymptomCheckerPage from './pages/SymptomCheckerPage';
import { appointmentRequest } from './lib/api';
import NotificationBell from './components/NotificationBell';

const PaymentPage = React.lazy(() => import('./pages/PaymentPage'));

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const API_BASE_URL_CANDIDATES = Array.from(
  new Set(
    [
      configuredApiBaseUrl,
      'http://localhost:8000/api/patients',
      'http://localhost:8002/api/patients'
    ].filter(Boolean)
  )
);

const PREVIEW_ORIGIN_CANDIDATES = Array.from(
  new Set(
    API_BASE_URL_CANDIDATES
      .map((url) => {
        try {
          return new URL(url).origin;
        } catch {
          return null;
        }
      })
      .filter(Boolean)
  )
);

const ROLE_PRIVILEGES = {
  patient: [
    'browse_doctors',
    'book_appointments',
    'video_consultations',
    'upload_reports',
    'receive_prescriptions',
    'manage_profile'
  ],
  doctor: [
    'manage_availability',
    'conduct_consultations',
    'issue_prescriptions',
    'view_patient_records',
    'manage_profile'
  ],
  admin: [
    'manage_user_accounts',
    'verify_doctor_registrations',
    'platform_operations',
    'manage_profile'
  ]
};

const normalizeRole = (role) => (['patient', 'doctor', 'admin'].includes(role) ? role : 'patient');

const formatTime12h = (time24 = '') => {
  const [h, m] = String(time24).split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time24 || 'N/A';
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
};

const getAppointmentTimestamp = (appointment) =>
  new Date(`${appointment.slotDate || ''}T${appointment.slotTime || '00:00'}:00`).getTime();

const formatAppointmentDate = (dateStr) => {
  if (!dateStr) return 'Unknown date';
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
};

const getReportPreviewUrl = (report) => {
  if (!report) return null;

  const origin = PREVIEW_ORIGIN_CANDIDATES[0] || window.location.origin;

  if (report.filePath) {
    const normalizedPath = report.filePath.startsWith('/uploads/')
      ? report.filePath.replace('/uploads/', '/patient-uploads/')
      : report.filePath;

    if (/^https?:\/\//i.test(normalizedPath)) {
      return normalizedPath;
    }

    return `${origin}${normalizedPath.startsWith('/') ? '' : '/'}${normalizedPath}`;
  }

  if (report.fileName) {
    return `${origin}/patient-uploads/reports/${encodeURIComponent(report.fileName)}`;
  }

  return null;
};

const getProfileImagePreviewUrl = (imagePath) => {
  if (!imagePath) return '';
  if (/^https?:\/\//i.test(imagePath)) return imagePath;

  const origin = PREVIEW_ORIGIN_CANDIDATES[0] || window.location.origin;
  return `${origin}${String(imagePath).startsWith('/') ? '' : '/'}${String(imagePath)}`;
};

const Card = ({ className, children }) => (
  <div className={cn('bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 md:p-8', className)}>
    {children}
  </div>
);

const Input = ({ icon: Icon, className, ...props }) => (
  <div className={cn("relative mb-4", className)}>
    {Icon && (
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
        <Icon size={18} />
      </div>
    )}
    <input
      className={cn(
        'block w-full rounded-xl border-slate-200 bg-slate-50/50 border py-3 px-4 text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 outline-none placeholder:text-slate-400',
        Icon && 'pl-11'
      )}
      {...props}
    />
  </div>
);

const Button = ({ children, variant = 'primary', className, ...props }) => {
  const variants = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/20 hover:shadow-indigo-600/30 font-medium',
    secondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm font-medium',
    danger: 'bg-rose-500 hover:bg-rose-600 text-white shadow-sm shadow-rose-500/20 font-medium'
  };
  return (
    <button
      className={cn(
        'flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

function AppContent() {
  const { isSignedIn, getToken } = useAuth();
  const { signOut } = useClerk();
  const { user } = useUser();

  const clerkDisplayName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
    '';
  const clerkEmail = user?.primaryEmailAddress?.emailAddress || '';
  const clerkPhone = user?.primaryPhoneNumber?.phoneNumber || '';

  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isRoleResolved, setIsRoleResolved] = useState(false);
  const [message, setMessage] = useState('');
  const [reports, setReports] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [prescriptionsLoading, setPrescriptionsLoading] = useState(false);
  const [prescriptionsError, setPrescriptionsError] = useState('');
  const [currentRole, setCurrentRole] = useState('patient');
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminSection, setAdminSection] = useState('overview');
  const [doctorSection, setDoctorSection] = useState('overview');
  const [patientSection, setPatientSection] = useState('appointments');
  const [adminNewUser, setAdminNewUser] = useState({ name: '', username: '', email: '', password: '', role: 'patient', phone: '' });
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [editingAdminUserId, setEditingAdminUserId] = useState(null);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [adminEditForm, setAdminEditForm] = useState({ name: '', email: '', role: 'patient', phone: '' });
  const [editingReportId, setEditingReportId] = useState(null);
  const [editingReportForm, setEditingReportForm] = useState({ title: '', description: '' });
  const [doctorAppointments, setDoctorAppointments] = useState([]);
  const [doctorAppointmentsLoading, setDoctorAppointmentsLoading] = useState(false);
  const [doctorAppointmentsError, setDoctorAppointmentsError] = useState('');
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState('');

  const patientEmail = patient?.email || '';
  const visibleEmail =
    clerkEmail ||
    (patientEmail && !patientEmail.endsWith('@clerk.local') ? patientEmail : '');

  const effectiveRole = normalizeRole(currentRole);
  const rolePrivileges = ROLE_PRIVILEGES[effectiveRole] || ROLE_PRIVILEGES.patient;
  const hasPrivilege = (privilege) => rolePrivileges.includes(privilege);

  const effectivePatientName =
    patient?.name && patient.name !== 'Clerk User'
      ? patient.name
      : clerkDisplayName || patient?.name || 'Patient';
  const doctorRecordId = patient?.id ?? patient?._id ?? null;
  const profileImageUrl = profileImagePreview || getProfileImagePreviewUrl(patient?.image);

  const navigate = useNavigate();
  const location = useLocation();

  const [profileForm, setProfileForm] = useState({ name: '', phone: '', age: '', gender: '', address: '' });
  const [reportForm, setReportForm] = useState({ title: '', description: '', file: null });

  const showError = (err, fallback) => {
    setMessage({ type: 'error', text: err?.message || fallback || 'Something went wrong' });
  };

  const showSuccess = (text) => {
    setMessage({ type: 'success', text });
  };

  const request = async (path, options = {}) => {
    let lastFailure = null;
    const timeoutMs = 8000;

    for (const baseUrl of API_BASE_URL_CANDIDATES) {
      try {
        const token = await getToken();
        const headers = {
          ...(options.headers || {}),
          ...(clerkEmail ? { 'x-clerk-email': clerkEmail } : {}),
          ...(clerkDisplayName ? { 'x-clerk-name': clerkDisplayName } : {}),
          ...(clerkPhone ? { 'x-clerk-phone': clerkPhone } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(
          `${baseUrl}${path}`,
          {
            ...options,
            headers,
            signal: controller.signal
          }
        ).finally(() => clearTimeout(timeoutId));
        const data = await response.json().catch(() => ({}));

        if (response.ok) return data;

        const isServerUnavailable = [502, 503, 504].includes(response.status);
        if (isServerUnavailable) {
          lastFailure = new Error(`Cannot reach backend at ${baseUrl}.`);
          continue;
        }

        throw new Error(data.message || `Request failed (${response.status})`);
      } catch (error) {
        lastFailure =
          error?.name === 'AbortError'
            ? new Error(`Request timed out after ${timeoutMs / 1000}s at ${baseUrl}.`)
            : error;
        const isNetworkError = error?.name === 'TypeError' || error?.name === 'AbortError';
        if (!isNetworkError) throw error;
      }
    }

    throw new Error(
      lastFailure?.message ||
      'Cannot connect to backend. Start Patient Service (port 8002), API Gateway (port 8000), and MongoDB.'
    );
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await request('/profile');
      const profile = data?.patient || data?.user || data?.profile || null;

      if (!profile) {
        throw new Error('Profile response did not include patient data.');
      }

      setPatient(profile);
      setCurrentRole(normalizeRole(profile?.role));

      const profileName =
        profile?.name && profile.name !== 'Clerk User'
          ? profile.name
          : clerkDisplayName;

      setProfileForm({
        name: profileName || '',
        phone: profile?.phone || clerkPhone || '',
        age: profile?.age || '',
        gender: String(profile?.gender || '').trim().toLowerCase(),
        address: profile?.address || ''
      });

      return profile;
    } catch (err) {
      showError(err, 'Failed to fetch profile');
      return null;
    } finally {
      setIsRoleResolved(true);
      setLoading(false);
    }
  };

  const fetchReports = async () => {
    try {
      const data = await request('/reports');
      setReports(data.reports || []);
    } catch (err) {
      showError(err, 'Failed to load reports');
    }
  };

  const fetchPrescriptions = async () => {
    try {
      setPrescriptionsLoading(true);
      setPrescriptionsError('');
      const data = await request('/prescriptions');
      setPrescriptions(data.prescriptions || []);
    } catch (err) {
      setPrescriptions([]);
      setPrescriptionsError(err.message || 'Failed to load prescriptions');
    } finally {
      setPrescriptionsLoading(false);
    }
  };

  const fetchAdminUsers = async () => {
    try {
      const data = await request('/admin/users');
      setAdminUsers(data.users || []);
    } catch (err) {
      showError(err, 'Failed to load users');
    }
  };

  useEffect(() => {
    if (!isSignedIn) {
      setPatient(null);
      setReports([]);
      setPrescriptions([]);
      setPrescriptionsError('');
      setPrescriptionsLoading(false);
      setCurrentRole('patient');
      setIsRoleResolved(false);
      setAdminUsers([]);
      setAdminSection('overview');
      setMessage('');
      setProfileForm({ name: '', phone: '', age: '', gender: '', address: '' });
      setProfileImageFile(null);
      setProfileImagePreview('');
      setReportForm({ title: '', description: '', file: null });
      return;
    }

    const path = location.pathname;
    const shouldLoadProtectedData =
      path === '/dashboard' ||
      path === '/profile' ||
      path === '/doctors' ||
      path === '/appointments' ||
      path === '/prescriptions' ||
      path.startsWith('/book/');
    if (shouldLoadProtectedData) {
      setIsRoleResolved(false);
      const loadProtectedData = async () => {
        const profile = await fetchProfile();
        const resolvedRole = normalizeRole(profile?.role);

        if (resolvedRole === 'patient') {
          await fetchReports();
          await fetchPrescriptions();
        } else {
          setReports([]);
          setPrescriptions([]);
        }
      };
      loadProtectedData();
    } else {
      setIsRoleResolved(true);
    }
  }, [isSignedIn, user?.id, location.pathname]);

  useEffect(() => {
    setAdminSection('overview');
    setDoctorSection('overview');
    setPatientSection('appointments');
  }, [effectiveRole]);

  useEffect(() => {
    let active = true;

    const loadDoctorAppointments = async () => {
      if (!isSignedIn || effectiveRole !== 'doctor' || !doctorRecordId || location.pathname !== '/dashboard') {
        if (active) {
          setDoctorAppointments([]);
          setDoctorAppointmentsError('');
          setDoctorAppointmentsLoading(false);
        }
        return;
      }

      try {
        setDoctorAppointmentsLoading(true);
        setDoctorAppointmentsError('');
        const data = await appointmentRequest(`?doctorId=${encodeURIComponent(String(doctorRecordId))}`, getToken);
        if (active) {
          setDoctorAppointments(Array.isArray(data?.appointments) ? data.appointments : []);
        }
      } catch (error) {
        if (active) {
          setDoctorAppointments([]);
          setDoctorAppointmentsError(error?.message || 'Failed to load doctor appointments');
        }
      } finally {
        if (active) {
          setDoctorAppointmentsLoading(false);
        }
      }
    };

    loadDoctorAppointments();
    return () => {
      active = false;
    };
  }, [isSignedIn, effectiveRole, doctorRecordId, location.pathname, getToken]);

  const doctorDashboardStats = useMemo(() => {
    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];

    const todayAppointments = doctorAppointments.filter(
      (appointment) => appointment.slotDate === today && appointment.status !== 'cancelled'
    );
    const pendingCount = doctorAppointments.filter((appointment) => appointment.status === 'pending').length;
    const completedToday = doctorAppointments.filter(
      (appointment) => appointment.slotDate === today && appointment.status === 'completed'
    ).length;
    const upcoming = doctorAppointments
      .filter((appointment) => ['pending', 'confirmed'].includes(appointment.status) && getAppointmentTimestamp(appointment) >= now)
      .sort((a, b) => getAppointmentTimestamp(a) - getAppointmentTimestamp(b));

    return {
      todayCount: todayAppointments.length,
      pendingCount,
      completedToday,
      upcoming
    };
  }, [doctorAppointments]);

  const onSaveProfile = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      setLoading(true);
      const normalizedGender = String(profileForm.gender || '').trim().toLowerCase();
      const normalizedAge = profileForm.age === '' || profileForm.age === null || profileForm.age === undefined
        ? undefined
        : Number(profileForm.age);

      const payload = {
        ...profileForm,
        age: Number.isFinite(normalizedAge) ? normalizedAge : undefined,
        gender: normalizedGender || undefined
      };
      const data = await request('/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setPatient(data.patient);
      showSuccess('Profile updated successfully');
      navigate('/dashboard');
    } catch (err) {
      showError(err, 'Profile update failed');
    } finally {
      setLoading(false);
    }
  };

  const onSelectProfileImage = (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;

    if (!String(file.type || '').startsWith('image/')) {
      showError(new Error('Please select a valid image file.'));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showError(new Error('Image size must be 5MB or less.'));
      return;
    }

    const preview = URL.createObjectURL(file);
    setProfileImageFile(file);
    setProfileImagePreview(preview);
  };

  const onUploadProfileImage = async () => {
    if (!profileImageFile) {
      showError(new Error('Please choose an image before uploading.'));
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('image', profileImageFile);

      const data = await request('/profile/image', {
        method: 'POST',
        body: formData
      });

      if (data?.patient) {
        setPatient(data.patient);
      }

      if (profileImagePreview) {
        URL.revokeObjectURL(profileImagePreview);
      }
      setProfileImagePreview('');
      setProfileImageFile(null);
      showSuccess('Profile image updated successfully');
    } catch (err) {
      showError(err, 'Profile image upload failed');
    } finally {
      setLoading(false);
    }
  };

  const onUploadReport = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!reportForm.file) return showError(new Error('Please select a report file'));

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('title', reportForm.title);
      formData.append('description', reportForm.description);
      formData.append('report', reportForm.file);

      await request('/reports', {
        method: 'POST',
        body: formData
      });
      setReportForm({ title: '', description: '', file: null });
      await fetchReports();
      showSuccess('Report uploaded successfully');
    } catch (err) {
      showError(err, 'Report upload failed');
    } finally {
      setLoading(false);
    }
  };

  const onStartEditReport = (report) => {
    setEditingReportId(report._id);
    setEditingReportForm({
      title: report.title || '',
      description: report.description || ''
    });
  };

  const onCancelEditReport = () => {
    setEditingReportId(null);
    setEditingReportForm({ title: '', description: '' });
  };

  const onSaveEditReport = async (reportId) => {
    setMessage('');
    try {
      setLoading(true);
      await request(`/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editingReportForm.title,
          description: editingReportForm.description
        })
      });
      await fetchReports();
      onCancelEditReport();
      showSuccess('Report updated successfully');
    } catch (err) {
      showError(err, 'Failed to update report');
    } finally {
      setLoading(false);
    }
  };

  const onDeleteReport = async (reportId) => {
    setMessage('');
    const confirmed = window.confirm('Delete this report permanently?');
    if (!confirmed) return;

    try {
      setLoading(true);
      await request(`/reports/${reportId}`, {
        method: 'DELETE'
      });
      await fetchReports();
      if (editingReportId === reportId) {
        onCancelEditReport();
      }
      showSuccess('Report deleted successfully');
    } catch (err) {
      showError(err, 'Failed to delete report');
    } finally {
      setLoading(false);
    }
  };

  const onChangeUserRole = async (userId, role) => {
    setMessage('');
    try {
      setLoading(true);
      await request(`/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      });
      await fetchAdminUsers();
      showSuccess('User role updated successfully');
    } catch (err) {
      showError(err, 'Failed to update role');
    } finally {
      setLoading(false);
    }
  };

  const onCreateAdminUser = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      setLoading(true);
      await request('/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminNewUser)
      });
      setAdminNewUser({ name: '', username: '', email: '', password: '', role: 'patient', phone: '' });
      setIsCreateUserModalOpen(false);
      await fetchAdminUsers();
      showSuccess('User created successfully');
    } catch (err) {
      showError(err, 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const onStartEditAdminUser = (adminUser) => {
    setEditingAdminUserId(adminUser.id);
    setIsEditUserModalOpen(true);
    setAdminEditForm({
      name: adminUser.name || '',
      email: adminUser.email || '',
      role: adminUser.role || 'patient',
      phone: adminUser.phone || ''
    });
  };

  const onCancelEditAdminUser = () => {
    setEditingAdminUserId(null);
    setIsEditUserModalOpen(false);
    setAdminEditForm({ name: '', email: '', role: 'patient', phone: '' });
  };

  const onSaveAdminUser = async (userId) => {
    setMessage('');
    try {
      setLoading(true);
      await request(`/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminEditForm)
      });
      onCancelEditAdminUser();
      await fetchAdminUsers();
      showSuccess('User updated successfully');
    } catch (err) {
      showError(err, 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  const onDeleteAdminUser = async (userId) => {
    const confirmed = window.confirm('Delete this user? This action cannot be undone.');
    if (!confirmed) return;

    setMessage('');
    try {
      setLoading(true);
      await request(`/admin/users/${userId}`, {
        method: 'DELETE'
      });
      if (editingAdminUserId === userId) {
        onCancelEditAdminUser();
      }
      await fetchAdminUsers();
      showSuccess('User deleted successfully');
    } catch (err) {
      showError(err, 'Failed to delete user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      <header className="sticky top-4 z-50 w-full px-4 mb-4 md:mb-8 transition-all">
        <nav className="max-w-6xl mx-auto bg-white/80 backdrop-blur-2xl border border-slate-200/60 shadow-xl shadow-indigo-900/5 rounded-[2rem] px-5 md:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 md:p-3 rounded-2xl text-white shadow-lg shadow-indigo-200/50">
              <Activity size={24} strokeWidth={2.5} />
            </div>
            <span className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900">
              MediSync<span className="text-indigo-600">.ai</span>
            </span>
          </div>

          <div className="flex gap-1 md:gap-2 items-center">
            <Link to="/" className={cn("flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-xl text-sm font-bold transition-all", location.pathname === '/' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50')}>
              <Home size={18} /> <span className="hidden sm:inline">Home</span>
            </Link>

            <SignedIn>
              <Link to="/dashboard" className={cn("flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-xl text-sm font-bold transition-all", location.pathname === '/dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50')}>
                <Activity size={18} /> <span className="hidden sm:inline">Dashboard</span>
              </Link>
              {effectiveRole === 'patient' && <NotificationBell />}
              {effectiveRole === 'patient' && (
                <Link to="/symptom-checker" className={cn("flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-xl text-sm font-bold transition-all", location.pathname === '/symptom-checker' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50')}>
                  <Stethoscope size={18} /> <span className="hidden sm:inline">Symptom Checker</span>
                </Link>
              )}
              <div className="w-px h-6 bg-slate-200 mx-1 md:mx-2 hidden sm:block"></div>
              <button
                type="button"
                className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all"
                onClick={() => signOut({ redirectUrl: '/' })}
              >
                <LogOut size={18} /> <span className="hidden sm:inline">Sign Out</span>
              </button>
            </SignedIn>

            <SignedOut>
              <div className="w-px h-6 bg-slate-200 mx-1 md:mx-2 hidden sm:block"></div>
              <Link to="/signin">
                <button className="px-4 py-2 md:px-5 md:py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:text-slate-900 transition-all">Sign In</button>
              </Link>
              <Link to="/signup">
                <Button variant="primary" className="px-5 py-2 md:px-6 md:py-2.5 text-sm rounded-xl font-bold shadow-indigo-600/25">Get Started</Button>
              </Link>
            </SignedOut>
          </div>
        </nav>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 lg:px-8 lg:py-6">
        {message && (
          <div className={cn(
            'mb-8 p-4 rounded-2xl flex items-center gap-3 font-semibold border shadow-sm animate-in slide-in-from-top-4 fade-in duration-300',
            message.type === 'error' ? 'bg-rose-50 text-rose-700 border-rose-200/50 shadow-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-200/50 shadow-emerald-100'
          )}>
            {message.type === 'error' ? <AlertCircle size={20} className="text-rose-500" /> : <Shield size={20} className="text-emerald-500" />}
            {message.text}
          </div>
        )}

        <Routes>
          <Route
            path="/"
            element={
              <div className="space-y-10 md:space-y-12 pb-6">
                <section className="relative overflow-hidden rounded-[2.3rem] bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 text-white shadow-2xl border border-white/10">
                  <img
                    src="/home/hero.jpg"
                    alt="Doctors consulting with a patient"
                    className="absolute inset-0 w-full h-full object-cover"
                    width={1400}
                    height={900}
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-slate-950/50" />
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-indigo-950/70 to-blue-950/55" />
                  <div className="absolute top-0 right-0 -mr-20 -mt-20 w-72 h-72 rounded-full bg-blue-500/20 blur-[80px]"></div>
                  <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-indigo-500/20 blur-[80px]"></div>

                  <div className="relative z-10 p-6 md:p-10 lg:p-12 max-w-3xl">
                    <div>
                      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/15 text-blue-200 text-sm font-semibold mb-6 backdrop-blur-md">
                        <Activity size={16} /> Welcome to MediSync AI
                      </div>

                      <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight mb-4">
                        Manage your health confidently in one place
                      </h1>

                      <p className="max-w-2xl text-base md:text-lg text-indigo-100/85 mb-7 leading-relaxed">
                        Track appointments, maintain your medical records, and keep your profile current with a secure,
                        patient-first portal built for day-to-day healthcare needs.
                      </p>

                      <div className="grid sm:grid-cols-3 gap-3 mb-8">
                        <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3">
                          <p className="text-xs text-blue-200 uppercase tracking-wider font-semibold">Access</p>
                          <p className="text-lg font-bold text-white mt-1">24/7</p>
                        </div>
                        <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3">
                          <p className="text-xs text-blue-200 uppercase tracking-wider font-semibold">Security</p>
                          <p className="text-lg font-bold text-white mt-1">Protected</p>
                        </div>
                        <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3">
                          <p className="text-xs text-blue-200 uppercase tracking-wider font-semibold">Workflow</p>
                          <p className="text-lg font-bold text-white mt-1">Simple</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 max-w-xl">
                        <div className="rounded-xl border border-white/20 bg-white/10 p-3">
                          <p className="text-xs uppercase tracking-wider text-blue-200 font-semibold">Appointments</p>
                          <p className="mt-1 text-sm text-white">Plan and monitor upcoming visits</p>
                        </div>
                        <div className="rounded-xl border border-white/20 bg-white/10 p-3">
                          <p className="text-xs uppercase tracking-wider text-blue-200 font-semibold">Medical Files</p>
                          <p className="mt-1 text-sm text-white">Upload and manage records securely</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-7 flex flex-wrap gap-3">
                      <Link to="/doctors">
                        <button className="flex items-center gap-2 px-7 py-3.5 rounded-full bg-emerald-500 text-white font-bold hover:bg-emerald-600 transition-all shadow-[0_10px_30px_rgba(16,185,129,0.3)]">
                          <Stethoscope size={20} /> Browse Doctors
                        </button>
                      </Link>
                      <Link to="/dashboard">
                        <button className="flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-indigo-900 font-bold hover:bg-blue-50 transition-all shadow-[0_0_25px_rgba(255,255,255,0.22)]">
                          <Activity size={20} /> Go to Dashboard
                        </button>
                      </Link>
                      <Link to="/profile">
                        <button className="flex items-center gap-2 px-7 py-3.5 rounded-full bg-white/10 text-white font-bold hover:bg-white/15 border border-white/20 transition-all backdrop-blur-sm">
                          <User size={20} /> Profile Settings
                        </button>
                      </Link>
                    </div>
                  </div>
                </section>

                <section className="grid md:grid-cols-3 gap-6 md:gap-7">
                  <div className="group bg-white rounded-3xl p-7 shadow-xl shadow-gray-200/40 border border-gray-100 hover:-translate-y-1.5 transition-all duration-300">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center mb-5 shadow-lg shadow-blue-200/50">
                      <UploadCloud size={22} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2 tracking-tight">Secure Uploads</h3>
                    <p className="text-gray-500 leading-relaxed text-sm">Add prescriptions, test reports, and imaging documents with secure storage support.</p>
                  </div>

                  <div className="group bg-white rounded-3xl p-7 shadow-xl shadow-gray-200/40 border border-gray-100 hover:-translate-y-1.5 transition-all duration-300">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center mb-5 shadow-lg shadow-indigo-200/50">
                      <FileText size={22} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2 tracking-tight">Instant Access</h3>
                    <p className="text-gray-500 leading-relaxed text-sm">Find your records and visit information from dashboard modules anytime you need them.</p>
                  </div>

                  <div className="group bg-white rounded-3xl p-7 shadow-xl shadow-gray-200/40 border border-gray-100 hover:-translate-y-1.5 transition-all duration-300">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center mb-5 shadow-lg shadow-emerald-200/50">
                      <User size={22} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2 tracking-tight">Unified Profile</h3>
                    <p className="text-gray-500 leading-relaxed text-sm">Keep contact details updated so care providers always work with accurate patient information.</p>
                  </div>
                </section>

                <section className="grid lg:grid-cols-[1.05fr_0.95fr] gap-6 md:gap-8 items-stretch">
                  <Card className="rounded-3xl border-slate-200/80 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Care Workflow</p>
                    <h2 className="mt-2 text-2xl font-bold text-slate-900 tracking-tight">How to get the most from MediSync</h2>
                    <div className="mt-6 space-y-4">
                      <div className="flex gap-3">
                        <span className="h-7 w-7 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">1</span>
                        <p className="text-sm text-slate-600">Complete your profile details so appointments and follow-up care stay accurate.</p>
                      </div>
                      <div className="flex gap-3">
                        <span className="h-7 w-7 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">2</span>
                        <p className="text-sm text-slate-600">Visit doctors directory, choose specialty, and book a suitable appointment slot.</p>
                      </div>
                      <div className="flex gap-3">
                        <span className="h-7 w-7 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">3</span>
                        <p className="text-sm text-slate-600">Upload reports and manage history before or after consultations for continuity of care.</p>
                      </div>
                    </div>
                  </Card>

                  <div className="rounded-3xl overflow-hidden border border-slate-200 bg-white shadow-sm flex flex-col">
                    <img
                      src="/home/patient.jpg"
                      alt="Patient reviewing medical information"
                      className="h-56 md:h-64 w-full object-cover"
                      width={900}
                      height={560}
                      decoding="async"
                    />
                    <div className="p-6 flex-1">
                      <h3 className="text-lg font-bold text-slate-900">Patient-first experience</h3>
                      <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                        Designed to reduce confusion and save time with intuitive navigation, clear actions, and
                        informative sections that match real healthcare needs.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link to="/doctors" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
                          Find Doctors
                        </Link>
                        <Link to="/appointments" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100">
                          My Appointments
                        </Link>
                        <Link to="/profile" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                          Profile
                        </Link>
                      </div>
                    </div>
                  </div>
                </section>

                <footer className="rounded-3xl border border-slate-200 bg-slate-900 text-slate-300 px-6 md:px-8 py-8 md:py-10">
                  <div className="grid md:grid-cols-3 gap-7">
                    <div>
                      <div className="inline-flex items-center gap-2 text-white font-bold text-lg tracking-tight">
                        <Activity size={18} /> MediSync.ai
                      </div>
                      <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                        Connected care platform for appointments, health records, and secure profile management.
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Quick Links</h4>
                      <div className="space-y-2 text-sm">
                        <Link to="/dashboard" className="block hover:text-blue-300 transition-colors">Dashboard</Link>
                        <Link to="/doctors" className="block hover:text-blue-300 transition-colors">Doctors Directory</Link>
                        <Link to="/appointments" className="block hover:text-blue-300 transition-colors">Appointments</Link>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Support</h4>
                      <div className="space-y-2 text-sm text-slate-300">
                        <p className="flex items-center gap-2"><Smartphone size={16} className="text-blue-400" /> +94 11 555 0100</p>
                        <p className="flex items-center gap-2"><MapPin size={16} className="text-blue-400" /> MediSync Health, Colombo</p>
                        <p className="text-xs text-slate-500 pt-1">For emergency care, contact local emergency services immediately.</p>
                      </div>
                    </div>
                  </div>
                </footer>
              </div>
            }
          />

          <Route
            path="/signin/*"
            element={
              isSignedIn ? (
                <Navigate to="/" replace />
              ) : (
                <div className="max-w-md mx-auto">
                  <Card className="p-4 md:p-6">
                    <SignIn routing="path" path="/signin" signUpUrl="/signup" forceRedirectUrl="/" />
                  </Card>
                </div>
              )
            }
          />

          <Route
            path="/signup/*"
            element={
              isSignedIn ? (
                <Navigate to="/" replace />
              ) : (
                <div className="max-w-md mx-auto">
                  <Card className="p-4 md:p-6">
                    <SignUp routing="path" path="/signup" signInUrl="/signin" forceRedirectUrl="/" />
                  </Card>
                </div>
              )
            }
          />

          <Route
            path="/dashboard"
            element={
              isSignedIn ? (
                !isRoleResolved ? (
                  <Card className="max-w-2xl mx-auto text-center py-12">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4 animate-pulse">
                      <Activity size={26} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">Loading your dashboard...</h3>
                    <p className="text-slate-500 mt-1">Preparing role-based workspace.</p>
                  </Card>
                ) : effectiveRole !== 'patient' ? (
                  <Card className="max-w-2xl mx-auto text-center py-12">
                    <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
                      <Shield size={26} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">Patient portal only</h3>
                    <p className="text-slate-500 mt-1">This frontend only supports patient accounts. Please sign out and use the correct dashboard.</p>
                    <div className="mt-5 flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => signOut({ redirectUrl: '/signin' })}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 text-white font-semibold hover:bg-slate-900 transition-all"
                      >
                        Sign out
                      </button>
                      {effectiveRole === 'admin' && (
                        <a
                          href="http://localhost:5174/signin"
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-all"
                        >
                          Open Admin App
                        </a>
                      )}
                    </div>
                  </Card>
                ) : effectiveRole === 'admin' ? (
                  <Card className="max-w-2xl mx-auto text-center py-12">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
                      <Shield size={26} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">Admin dashboard moved</h3>
                    <p className="text-slate-500 mt-1">Use the dedicated Admin frontend to manage users and profile details.</p>
                    <div className="mt-5">
                      <a
                        href="http://localhost:5174/signin"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-all"
                      >
                        Open Admin App
                      </a>
                    </div>
                  </Card>
                ) : effectiveRole === 'doctor' ? (
                  <div className="grid lg:grid-cols-[260px_1fr] gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Card className="p-4 border-slate-200/60 sticky top-24 h-max bg-white/80 backdrop-blur-xl">
                      <div className="mb-6 px-3">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Doctor Panel</h3>
                        <p className="text-slate-800 font-semibold tracking-tight">Clinical Workspace</p>
                      </div>
                      <div className="space-y-1.5 focus:outline-none">
                        <button
                          type="button"
                          className={cn('w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-colors outline-none', doctorSection === 'overview' ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100/50' : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:text-slate-900')}
                          onClick={() => setDoctorSection('overview')}
                        >
                          <Activity size={18} className={doctorSection === 'overview' ? 'text-indigo-600' : 'text-slate-400'} /> Dashboard Overview
                        </button>
                        {hasPrivilege('manage_availability') && (
                          <button
                            type="button"
                            className={cn('w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-colors outline-none', doctorSection === 'availability' ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100/50' : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:text-slate-900')}
                            onClick={() => setDoctorSection('availability')}
                          >
                            <Calendar size={18} className={doctorSection === 'availability' ? 'text-indigo-600' : 'text-slate-400'} /> Availability
                          </button>
                        )}
                        {hasPrivilege('conduct_consultations') && (
                          <button
                            type="button"
                            className={cn('w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-colors outline-none', doctorSection === 'consultations' ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100/50' : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:text-slate-900')}
                            onClick={() => setDoctorSection('consultations')}
                          >
                            <Stethoscope size={18} className={doctorSection === 'consultations' ? 'text-indigo-600' : 'text-slate-400'} /> Consultations
                          </button>
                        )}
                        {hasPrivilege('issue_prescriptions') && (
                          <button
                            type="button"
                            className={cn('w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-colors outline-none', doctorSection === 'prescriptions' ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100/50' : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:text-slate-900')}
                            onClick={() => setDoctorSection('prescriptions')}
                          >
                            <FileText size={18} className={doctorSection === 'prescriptions' ? 'text-indigo-600' : 'text-slate-400'} /> Prescriptions
                          </button>
                        )}
                        {hasPrivilege('view_patient_records') && (
                          <button
                            type="button"
                            className={cn('w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-colors outline-none', doctorSection === 'records' ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100/50' : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:text-slate-900')}
                            onClick={() => setDoctorSection('records')}
                          >
                            <Users size={18} className={doctorSection === 'records' ? 'text-indigo-600' : 'text-slate-400'} /> Patient Records
                          </button>
                        )}
                        {hasPrivilege('manage_profile') && (
                          <button
                            type="button"
                            className={cn('w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-colors outline-none', doctorSection === 'profile' ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100/50' : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:text-slate-900')}
                            onClick={() => setDoctorSection('profile')}
                          >
                            <User size={18} className={doctorSection === 'profile' ? 'text-indigo-600' : 'text-slate-400'} /> Profile Settings
                          </button>
                        )}
                      </div>
                    </Card>

                    <div className="space-y-8">
                      {doctorSection === 'overview' && (
                        <>
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60">
                            <div className="flex items-center gap-5">
                              <div className="h-16 w-16 bg-emerald-50 text-emerald-600 rounded-2xl rotate-3 flex items-center justify-center shadow-inner">
                                <Stethoscope size={32} className="-rotate-3" />
                              </div>
                              <div>
                                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Doctor Dashboard</h2>
                                <p className="text-slate-500 text-sm font-medium mt-1">Hello, {effectivePatientName} (Dr.). Here is your schedule today.</p>
                              </div>
                            </div>
                          </div>

                          <div className="grid md:grid-cols-3 gap-6">
                            <Card className="p-6 relative overflow-hidden group">
                              <div className="h-1 bg-indigo-500 absolute top-0 left-0 w-full opacity-50"></div>
                              <div className="flex justify-between items-start mb-4">
                                <p className="font-medium text-slate-500">Today Appointments</p>
                                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600 group-hover:scale-110 transition-transform"><Calendar size={20} /></div>
                              </div>
                              <p className="text-4xl font-extrabold text-slate-800 tracking-tight">{doctorDashboardStats.todayCount}</p>
                            </Card>
                            <Card className="p-6 relative overflow-hidden group">
                              <div className="h-1 bg-amber-500 absolute top-0 left-0 w-full opacity-50"></div>
                              <div className="flex justify-between items-start mb-4">
                                <p className="font-medium text-slate-500">Pending Consults</p>
                                <div className="p-2 bg-amber-50 rounded-xl text-amber-600 group-hover:scale-110 transition-transform"><Activity size={20} /></div>
                              </div>
                              <p className="text-4xl font-extrabold text-slate-800 tracking-tight">{doctorDashboardStats.pendingCount}</p>
                            </Card>
                            <Card className="p-6 relative overflow-hidden group">
                              <div className="h-1 bg-emerald-500 absolute top-0 left-0 w-full opacity-50"></div>
                              <div className="flex justify-between items-start mb-4">
                                <p className="font-medium text-slate-500">Completed Today</p>
                                <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600 group-hover:scale-110 transition-transform"><Shield size={20} /></div>
                              </div>
                              <p className="text-4xl font-extrabold text-slate-800 tracking-tight">{doctorDashboardStats.completedToday}</p>
                            </Card>
                          </div>

                          <Card className="border-t-4 border-t-slate-200">
                            <div className="flex items-center justify-between gap-3 mb-4 px-1">
                              <h3 className="text-lg font-bold text-slate-800">Upcoming Appointments</h3>
                              <button
                                type="button"
                                onClick={() => setDoctorSection('consultations')}
                                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
                              >
                                Open consultations
                              </button>
                            </div>
                            {doctorAppointmentsLoading ? (
                              <div className="text-sm text-slate-500 px-1 inline-flex items-center gap-2">
                                <RefreshCw size={14} className="animate-spin" />
                                Loading upcoming appointments...
                              </div>
                            ) : doctorAppointmentsError ? (
                              <div className="rounded-xl border border-red-100 bg-red-50 text-red-700 text-sm px-4 py-3">
                                {doctorAppointmentsError}
                              </div>
                            ) : doctorDashboardStats.upcoming.length === 0 ? (
                              <div className="rounded-xl border border-slate-200 bg-slate-50 text-slate-600 text-sm px-4 py-3">
                                No upcoming appointments yet.
                              </div>
                            ) : (
                              <ul className="flex flex-col gap-3">
                                {doctorDashboardStats.upcoming.slice(0, 8).map((appointment) => (
                                  <li
                                    key={appointment.id}
                                    className="flex items-center justify-between gap-4 p-4 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors"
                                  >
                                    <div className="flex items-center gap-4 min-w-0">
                                      <div className={cn(
                                        'w-2.5 h-2.5 rounded-full shrink-0',
                                        appointment.status === 'confirmed' ? 'bg-blue-500' : 'bg-amber-500'
                                      )}></div>
                                      <div className="min-w-0">
                                        <p className="font-medium text-slate-800 truncate">
                                          {formatTime12h(appointment.slotTime)} · {formatAppointmentDate(appointment.slotDate)}
                                        </p>
                                        <p className="text-sm text-slate-500 truncate">
                                          {appointment.reason || 'Consultation scheduled'} · {String(appointment.status || 'pending')}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-xs text-slate-500">Patient #{String(appointment.patientId || '').slice(-6)}</span>
                                      {appointment.visitMode === 'telemedicine' && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 border border-sky-100 text-sky-700 text-xs px-2 py-1">
                                          <Video size={12} />
                                          Video
                                        </span>
                                      )}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </Card>
                        </>
                      )}

                      {doctorSection === 'availability' && hasPrivilege('manage_availability') && (
                        <Card className="p-8 border border-slate-200/80 bg-white/80 backdrop-blur-xl">
                          <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Manage Availability</h3>
                          <p className="text-slate-500 font-medium text-sm mt-1">Configure available slots, leave windows, and clinic timing.</p>
                          <div className="mt-6 p-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60">
                            <p className="text-slate-700 font-medium">Availability component can be merged into this doctor-only section.</p>
                          </div>
                        </Card>
                      )}

                      {doctorSection === 'consultations' && hasPrivilege('conduct_consultations') && (
                        <Card className="p-8 border border-slate-200/80 bg-white/80 backdrop-blur-xl">
                          <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Consultations</h3>
                          <p className="text-slate-500 font-medium text-sm mt-1">Conduct telemedicine or in-person consultations securely.</p>
                          <div className="mt-6 p-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60">
                            <p className="text-slate-700 font-medium">Consultation module can be plugged here for doctors only.</p>
                          </div>
                        </Card>
                      )}

                      {doctorSection === 'prescriptions' && hasPrivilege('issue_prescriptions') && (
                        <Card className="p-8 border border-slate-200/80 bg-white/80 backdrop-blur-xl">
                          <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Digital Prescriptions</h3>
                          <p className="text-slate-500 font-medium text-sm mt-1">Issue and manage digital prescriptions for patients.</p>
                          <div className="mt-6 p-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60">
                            <p className="text-slate-700 font-medium">Prescription composer can be merged into this protected section.</p>
                          </div>
                        </Card>
                      )}

                      {doctorSection === 'records' && hasPrivilege('view_patient_records') && (
                        <Card className="p-8 border border-slate-200/80 bg-white/80 backdrop-blur-xl">
                          <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Patient Records</h3>
                          <p className="text-slate-500 font-medium text-sm mt-1">View patient health history and related medical records.</p>
                          <div className="mt-6 p-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60">
                            <p className="text-slate-700 font-medium">Patient records view can be merged here as doctor-only content.</p>
                          </div>
                        </Card>
                      )}

                      {doctorSection === 'profile' && hasPrivilege('manage_profile') && (
                        <Card className="max-w-2xl bg-white/80 backdrop-blur-xl border border-slate-200/60">
                          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><User size={20} /></div> Profile Settings
                          </h2>
                          <form onSubmit={onSaveProfile} className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                              <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-2">Account Email</label>
                                <Input value={visibleEmail} readOnly disabled className="bg-slate-50" />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                                <Input icon={User} value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
                                <Input icon={Smartphone} value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Age</label>
                                <Input icon={Calendar} type="number" min="0" value={profileForm.age} onChange={(e) => setProfileForm({ ...profileForm, age: e.target.value })} />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Gender</label>
                                <select className="w-full bg-white border border-slate-200/60 rounded-xl px-4 py-3 placeholder-slate-400 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 hover:border-indigo-300" value={profileForm.gender} onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}>
                                  <option value="">Select Gender</option>
                                  <option value="male">Male</option>
                                  <option value="female">Female</option>
                                  <option value="other">Other</option>
                                </select>
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
                                <Input icon={MapPin} value={profileForm.address} onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })} />
                              </div>
                            </div>
                            <div className="pt-6 border-t border-slate-100 flex justify-end">
                              <Button type="submit" disabled={loading} className="w-full md:w-auto px-8 shadow-indigo-600/30">
                                {loading ? 'Saving...' : 'Save Changes'}
                              </Button>
                            </div>
                          </form>
                        </Card>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid lg:grid-cols-[260px_1fr] gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Card className="p-4 border-slate-200/60 sticky top-24 h-max bg-white/80 backdrop-blur-xl">
                      <div className="mb-6 px-3">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Patient Portal</h3>
                        <p className="text-slate-800 font-semibold tracking-tight">Health Dashboard</p>
                      </div>
                      <div className="space-y-1.5 focus:outline-none">

                        {hasPrivilege('browse_doctors') && (
                          <button
                            type="button"
                            className={cn('w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-colors outline-none', patientSection === 'doctors' ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100/50' : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:text-slate-900')}
                            onClick={() => setPatientSection('doctors')}
                          >
                            <Stethoscope size={18} className={patientSection === 'doctors' ? 'text-indigo-600' : 'text-slate-400'} /> Browse Doctors
                          </button>
                        )}
                        {hasPrivilege('book_appointments') && (
                          <button
                            type="button"
                            className={cn('w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-colors outline-none', patientSection === 'appointments' ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100/50' : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:text-slate-900')}
                            onClick={() => setPatientSection('appointments')}
                          >
                            <Calendar size={18} className={patientSection === 'appointments' ? 'text-indigo-600' : 'text-slate-400'} /> Book Appointments
                          </button>
                        )}
                        {hasPrivilege('upload_reports') && (
                          <button
                            type="button"
                            className={cn('w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-colors outline-none', patientSection === 'reports' ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100/50' : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:text-slate-900')}
                            onClick={() => setPatientSection('reports')}
                          >
                            <FileText size={18} className={patientSection === 'reports' ? 'text-indigo-600' : 'text-slate-400'} /> Reports & Documents
                          </button>
                        )}
                        {hasPrivilege('receive_prescriptions') && (
                          <button
                            type="button"
                            className={cn('w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-colors outline-none', patientSection === 'prescriptions' ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100/50' : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:text-slate-900')}
                            onClick={() => setPatientSection('prescriptions')}
                          >
                            <Shield size={18} className={patientSection === 'prescriptions' ? 'text-indigo-600' : 'text-slate-400'} /> Prescriptions
                          </button>
                        )}
                        {hasPrivilege('manage_profile') && (
                          <button
                            type="button"
                            className={cn('w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-colors outline-none', patientSection === 'profile' ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100/50' : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:text-slate-900')}
                            onClick={() => setPatientSection('profile')}
                          >
                            <User size={18} className={patientSection === 'profile' ? 'text-indigo-600' : 'text-slate-400'} /> Profile Settings
                          </button>
                        )}
                      </div>
                    </Card>

                    <div className="space-y-8">


                      {patientSection === 'doctors' && hasPrivilege('browse_doctors') && (
                        <DoctorsList />
                      )}

                      {patientSection === 'appointments' && hasPrivilege('book_appointments') && (
                        <MyAppointments
                          patient={patient}
                          profileReady={isRoleResolved}
                          onRetryProfile={fetchProfile}
                        />
                      )}

                      {patientSection === 'consultations' && hasPrivilege('video_consultations') && (
                        <Card className="p-8 border border-slate-200/80 bg-white/80 backdrop-blur-xl">
                          <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Video Consultations</h3>
                          <p className="text-slate-500 font-medium text-sm mt-1">Attend secure telemedicine sessions directly from the dashboard.</p>
                          <div className="mt-6 p-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60">
                            <p className="text-slate-700 font-medium">Video consultation component can be merged here for patients only.</p>
                          </div>
                        </Card>
                      )}

                      {patientSection === 'reports' && hasPrivilege('upload_reports') && (
                        <div className="grid md:grid-cols-12 gap-8">
                      <div className="md:col-span-5">
                        <Card className="sticky top-24 bg-gradient-to-br from-white to-slate-50">
                          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><UploadCloud size={18} /></div> Upload Report
                          </h3>
                          <form onSubmit={onUploadReport} className="space-y-4">
                            <Input placeholder="Report Title (e.g. Blood Test)" value={reportForm.title} onChange={(e) => setReportForm({ ...reportForm, title: e.target.value })} required />
                            <Input placeholder="Brief Description" value={reportForm.description} onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })} className="mb-2" />
                            <label className="relative flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 bg-white rounded-2xl hover:border-indigo-400 hover:bg-indigo-50/50 transition-all text-center cursor-pointer group">
                              <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => setReportForm({ ...reportForm, file: e.target.files?.[0] || null })} required />
                              <div className="p-4 bg-slate-50 text-slate-400 rounded-full mb-3 group-hover:bg-indigo-100 group-hover:text-indigo-500 transition-colors">
                                <FileText size={28} />
                              </div>
                              <span className="text-sm font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">
                                {reportForm.file ? reportForm.file.name : 'Click or drop file here'}
                              </span>
                              <span className="text-xs text-slate-400 mt-1">PDF, JPG, PNG up to 10MB</span>
                            </label>
                            <Button type="submit" className="w-full mt-2 py-3 shadow-indigo-600/30" disabled={loading}>
                              {loading ? 'Uploading safely...' : 'Upload Document'}
                            </Button>
                          </form>
                        </Card>
                      </div>

                      <div className="md:col-span-7 space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <FileText className="text-indigo-600" size={24} /> Document History
                          </h3>
                          <span className="bg-slate-100 text-slate-600 text-xs px-3 py-1 font-bold rounded-full">{reports.length} Total</span>
                        </div>
                        
                        {reports.length === 0 ? (
                          <div className="text-center py-16 px-4 border border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                            <div className="w-20 h-20 bg-slate-100 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
                              <FileText size={32} />
                            </div>
                            <h4 className="text-slate-800 font-bold mb-1">No documents found</h4>
                            <p className="text-slate-500 text-sm">Upload your first lab report or prescription to get started.</p>
                          </div>
                        ) : (
                          <ul className="space-y-4">
                            {reports.map((report) => (
                              <li key={report._id || report.fileName} className="p-5 rounded-2xl border border-slate-200/60 hover:border-indigo-200 hover:shadow-md transition-all shadow-sm bg-white flex flex-col sm:flex-row sm:items-start gap-5">
                                <div className="bg-indigo-50 text-indigo-600 p-4 rounded-2xl shrink-0 flex items-center justify-center">
                                  <FileText size={28} />
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                  {editingReportId === report._id ? (
                                    <div className="space-y-3 pb-2">
                                      <Input
                                        placeholder="Report title"
                                        value={editingReportForm.title}
                                        onChange={(e) => setEditingReportForm((prev) => ({ ...prev, title: e.target.value }))}
                                        className="mb-0"
                                      />
                                      <Input
                                        placeholder="Brief description"
                                        value={editingReportForm.description}
                                        onChange={(e) => setEditingReportForm((prev) => ({ ...prev, description: e.target.value }))}
                                        className="mb-0"
                                      />
                                      <div className="flex flex-wrap items-center gap-2 mt-2">
                                        <Button
                                          type="button"
                                          className="px-4 py-2 text-xs"
                                          onClick={() => onSaveEditReport(report._id)}
                                          disabled={loading}
                                        >
                                          Save Changes
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="secondary"
                                          className="px-4 py-2 text-xs"
                                          onClick={onCancelEditReport}
                                          disabled={loading}
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex flex-wrap items-start justify-between gap-2 overflow-hidden w-full">
                                        <div className="min-w-0 pr-4">
                                          <h4 className="text-lg font-bold text-slate-800 truncate mb-0.5">{report.title || 'Untitled Report'}</h4>
                                          <p className="text-xs font-mono text-slate-400 truncate bg-slate-100 inline-block px-2 py-0.5 rounded-md">{report.fileName}</p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                          {getReportPreviewUrl(report) && (
                                            <a href={getReportPreviewUrl(report)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors border border-indigo-100">
                                              Preview
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                      <p className="text-sm text-slate-500 mt-3 line-clamp-2 leading-relaxed">
                                        {report.description?.trim() || 'No description added.'}
                                      </p>
                                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-4 text-sm font-semibold">
                                        {report._id && (
                                          <button type="button" className="text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1.5" onClick={() => onStartEditReport(report)} disabled={loading}>
                                            <Settings size={14} /> Edit
                                          </button>
                                        )}
                                        {report._id && (
                                          <button type="button" className="text-slate-400 hover:text-rose-600 transition-colors flex items-center gap-1.5" onClick={() => onDeleteReport(report._id)} disabled={loading}>
                                            <AlertCircle size={14} /> Delete
                                          </button>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                        </div>
                      )}

                      {patientSection === 'prescriptions' && hasPrivilege('receive_prescriptions') && (
                        <Card className="p-8 border border-slate-200/80 bg-white/80 backdrop-blur-xl">
                          <h3 className="text-2xl font-bold text-slate-800 tracking-tight">My Prescriptions</h3>
                          <p className="text-slate-500 font-medium text-sm mt-1">View digital prescriptions issued by your doctors.</p>
                          <div className="mt-6 space-y-4">
                            {prescriptionsLoading ? (
                              <div className="text-sm text-slate-500 flex items-center gap-2">
                                <RefreshCw size={14} className="animate-spin" />
                                Loading prescriptions...
                              </div>
                            ) : prescriptionsError ? (
                              <div className="rounded-xl border border-red-100 bg-red-50 text-red-700 text-sm px-4 py-3">
                                {prescriptionsError}
                              </div>
                            ) : prescriptions.length === 0 ? (
                              <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                                <div className="w-16 h-16 bg-slate-100 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
                                  <Shield size={28} />
                                </div>
                                <h4 className="text-slate-800 font-bold mb-1">No prescriptions found</h4>
                                <p className="text-slate-500 text-sm">Prescriptions issued by your doctors will appear here after consultations.</p>
                              </div>
                            ) : (
                              <ul className="space-y-4">
                                {prescriptions.map((rx) => (
                                  <li
                                    key={rx._id}
                                    className="p-5 rounded-2xl border border-slate-200/70 hover:border-indigo-200 hover:shadow-md transition-all bg-white flex flex-col gap-3"
                                  >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                                          {rx.slotDate && rx.slotTime
                                            ? `${formatAppointmentDate(rx.slotDate)} · ${formatTime12h(rx.slotTime)}`
                                            : new Date(rx.createdAt).toLocaleString()}
                                        </p>
                                        <h4 className="text-base font-bold text-slate-800">
                                          {rx.doctorName}{' '}
                                          {rx.doctorSpeciality && (
                                            <span className="text-slate-500 font-medium text-sm">· {rx.doctorSpeciality}</span>
                                          )}
                                        </h4>
                                        {rx.reason && (
                                          <p className="text-xs text-slate-500 mt-1">Reason: {rx.reason}</p>
                                        )}
                                      </div>
                                      {rx.visitMode && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600 text-xs px-3 py-1 font-semibold">
                                          {rx.visitMode === 'telemedicine' ? (
                                            <>
                                              <Video size={12} /> Telemedicine
                                            </>
                                          ) : (
                                            'In-person'
                                          )}
                                        </span>
                                      )}
                                    </div>
                                    <div className="border border-slate-100 rounded-2xl bg-slate-50/60 p-3">
                                      <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
                                        Medications
                                      </p>
                                      <ul className="space-y-1.5">
                                        {(rx.medications || []).map((m, idx) => (
                                          <li key={`${rx._id}-m-${idx}`} className="text-sm text-slate-700 flex gap-2">
                                            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0"></span>
                                            <span>
                                              <span className="font-semibold">{m.drugName}</span>
                                              {m.dosage && <span className="text-slate-600"> · {m.dosage}</span>}
                                              {m.frequency && <span className="text-slate-600"> · {m.frequency}</span>}
                                              {m.duration && <span className="text-slate-600"> · {m.duration}</span>}
                                              {m.notes && (
                                                <span className="block text-xs text-slate-500 mt-0.5">
                                                  {m.notes}
                                                </span>
                                              )}
                                            </span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                    {rx.generalInstructions && (
                                      <div className="border border-amber-100 bg-amber-50/70 rounded-2xl px-4 py-3 text-sm text-amber-900">
                                        <p className="font-semibold text-xs uppercase tracking-wide mb-1 text-amber-700">
                                          General instructions
                                        </p>
                                        <p className="leading-relaxed">{rx.generalInstructions}</p>
                                      </div>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </Card>
                      )}

                      {patientSection === 'profile' && hasPrivilege('manage_profile') && (
                        <Card className="max-w-2xl bg-white/80 backdrop-blur-xl border border-slate-200/60">
                          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><User size={20} /></div> Profile Settings
                          </h2>
                          <div className="mb-6 p-4 rounded-2xl border border-slate-200 bg-slate-50/70">
                            <p className="text-sm font-semibold text-slate-700 mb-3">Profile Photo</p>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                              {profileImageUrl ? (
                                <img
                                  src={profileImageUrl}
                                  alt="Profile"
                                  className="h-20 w-20 rounded-2xl object-cover border border-slate-200"
                                />
                              ) : (
                                <div className="h-20 w-20 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center border border-indigo-200">
                                  <User size={28} />
                                </div>
                              )}
                              <div className="flex-1 flex flex-col sm:flex-row gap-3">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={onSelectProfileImage}
                                  className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
                                />
                                <Button type="button" variant="secondary" onClick={onUploadProfileImage} disabled={loading || !profileImageFile}>
                                  Upload
                                </Button>
                              </div>
                            </div>
                          </div>
                          <form onSubmit={onSaveProfile} className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                              <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-2">Account Email</label>
                                <Input value={visibleEmail} readOnly disabled className="bg-slate-50" />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                                <Input icon={User} value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
                                <Input icon={Smartphone} value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Age</label>
                                <Input icon={Calendar} type="number" min="0" value={profileForm.age} onChange={(e) => setProfileForm({ ...profileForm, age: e.target.value })} />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Gender</label>
                                <div className="relative">
                                  <select className="w-full bg-white border border-slate-200/60 rounded-xl px-4 py-3 placeholder-slate-400 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 hover:border-indigo-300" value={profileForm.gender} onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}>
                                    <option value="">Select Gender</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                  </select>
                                </div>
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
                                <Input icon={MapPin} value={profileForm.address} onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })} />
                              </div>
                            </div>
                            <div className="pt-6 border-t border-slate-100 flex justify-end">
                              <Button type="submit" disabled={loading} className="w-full md:w-auto px-8 shadow-indigo-600/30">
                                {loading ? 'Saving...' : 'Save Changes'}
                              </Button>
                            </div>
                          </form>
                        </Card>
                      )}
                    </div>
                  </div>
                )
              ) : (
                <Navigate to="/signin" replace />
              )
            }
          />

          <Route
            path="/profile"
            element={
              isSignedIn ? (
                <Card className="max-w-2xl mx-auto">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <User className="text-blue-600" /> Profile Settings
                  </h2>
                  <div className="mb-6 p-4 rounded-2xl border border-slate-200 bg-slate-50/70">
                    <p className="text-sm font-semibold text-slate-700 mb-3">Profile Photo</p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      {profileImageUrl ? (
                        <img
                          src={profileImageUrl}
                          alt="Profile"
                          className="h-20 w-20 rounded-2xl object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="h-20 w-20 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center border border-indigo-200">
                          <User size={28} />
                        </div>
                      )}
                      <div className="flex-1 flex flex-col sm:flex-row gap-3">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={onSelectProfileImage}
                          className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
                        />
                        <Button type="button" variant="secondary" onClick={onUploadProfileImage} disabled={loading || !profileImageFile}>
                          Upload
                        </Button>
                      </div>
                    </div>
                  </div>
                  <form onSubmit={onSaveProfile} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Account Email</label>
                        <Input value={visibleEmail} readOnly disabled />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                        <Input icon={User} value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                        <Input icon={Smartphone} value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Age</label>
                        <Input icon={Calendar} type="number" min="0" value={profileForm.age} onChange={(e) => setProfileForm({ ...profileForm, age: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                        <select className="block w-full rounded-lg border-gray-300 bg-gray-50 border py-3 px-4 text-gray-900 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none" value={profileForm.gender} onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}>
                          <option value="">Select Gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                        <Input icon={MapPin} value={profileForm.address} onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })} />
                      </div>
                    </div>
                    <div className="pt-4 border-t border-gray-100">
                      <Button type="submit" disabled={loading} className="w-full md:w-auto md:px-12">
                        {loading ? 'Saving...' : 'Save Profile Details'}
                      </Button>
                    </div>
                  </form>
                </Card>
              ) : (
                <Navigate to="/signin" replace />
              )
            }
          />

          <Route
            path="/doctors"
            element={
              isSignedIn ? (
                effectiveRole === 'patient' ? (
                  <DoctorsList />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              ) : (
                <Navigate to="/signin" replace />
              )
            }
          />

          <Route
            path="/book/:doctorId"
            element={
              isSignedIn ? (
                effectiveRole === 'patient' ? (
                  <BookAppointment patient={patient} profileReady={isRoleResolved} onRetryProfile={fetchProfile} />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              ) : (
                <Navigate to="/signin" replace />
              )
            }
          />

          <Route
            path="/appointments"
            element={
              isSignedIn ? (
                effectiveRole === 'patient' ? (
                  <MyAppointments patient={patient} profileReady={isRoleResolved} onRetryProfile={fetchProfile} />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              ) : (
                <Navigate to="/signin" replace />
              )
            }
          />

          <Route
            path="/appointments/:appointmentId/telemedicine"
            element={
              isSignedIn ? (
                effectiveRole === 'patient' ? (
                  <TelemedicineSession />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              ) : (
                <Navigate to="/signin" replace />
              )
            }
          />

          <Route
            path="/payment"
            element={
              isSignedIn ? (
                effectiveRole === 'patient' ? (
                  <Suspense
                    fallback={
                      <Card className="max-w-2xl mx-auto text-center py-12">
                        <h3 className="text-xl font-bold text-slate-800">Loading payment module…</h3>
                        <p className="text-slate-500 mt-1">Preparing secure checkout.</p>
                      </Card>
                    }
                  >
                    <PaymentPage />
                  </Suspense>
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              ) : (
                <Navigate to="/signin" replace />
              )
            }
          />

          <Route
            path="/payment-success"
            element={
              isSignedIn ? (
                effectiveRole === 'patient' ? (
                  <PaymentSuccessPage />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              ) : (
                <Navigate to="/signin" replace />
              )
            }
          />

          <Route
            path="/symptom-checker"
            element={
              isSignedIn ? (
                effectiveRole === 'patient' ? (
                  <SymptomCheckerPage patient={patient} clerkUserId={user?.id} />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              ) : (
                <Navigate to="/signin" replace />
              )
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
