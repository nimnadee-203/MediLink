import React, { useEffect, useState } from 'react';
import {
  BrowserRouter,
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
  AlertCircle
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SignIn, SignUp, SignedIn, SignedOut, useAuth, useClerk, useUser } from '@clerk/clerk-react';

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
  const [currentRole, setCurrentRole] = useState('patient');
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminSection, setAdminSection] = useState('overview');
  const [doctorSection, setDoctorSection] = useState('overview');
  const [patientSection, setPatientSection] = useState('overview');
  const [adminNewUser, setAdminNewUser] = useState({ name: '', username: '', email: '', password: '', role: 'patient', phone: '' });
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [editingAdminUserId, setEditingAdminUserId] = useState(null);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [adminEditForm, setAdminEditForm] = useState({ name: '', email: '', role: 'patient', phone: '' });
  const [editingReportId, setEditingReportId] = useState(null);
  const [editingReportForm, setEditingReportForm] = useState({ title: '', description: '' });

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

        const response = await fetch(`${baseUrl}${path}`, {
          ...options,
          headers
        });
        const data = await response.json().catch(() => ({}));

        if (response.ok) return data;

        const isServerUnavailable = [502, 503, 504].includes(response.status);
        if (isServerUnavailable) {
          lastFailure = new Error(`Cannot reach backend at ${baseUrl}.`);
          continue;
        }

        throw new Error(data.message || `Request failed (${response.status})`);
      } catch (error) {
        lastFailure = error;
        const isNetworkError = error?.name === 'TypeError';
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
      setPatient(data.patient);
      setCurrentRole(normalizeRole(data.patient?.role));

      const profileName =
        data.patient?.name && data.patient.name !== 'Clerk User'
          ? data.patient.name
          : clerkDisplayName;

      setProfileForm({
        name: profileName || '',
        phone: data.patient?.phone || clerkPhone || '',
        age: data.patient?.age || '',
        gender: data.patient?.gender || '',
        address: data.patient?.address || ''
      });
    } catch (err) {
      showError(err, 'Failed to fetch profile');
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
      setCurrentRole('patient');
      setIsRoleResolved(false);
      setAdminUsers([]);
      setAdminSection('overview');
      setMessage('');
      setProfileForm({ name: '', phone: '', age: '', gender: '', address: '' });
      setReportForm({ title: '', description: '', file: null });
      return;
    }

    const shouldLoadProtectedData = location.pathname === '/dashboard' || location.pathname === '/profile';
    if (shouldLoadProtectedData) {
      setIsRoleResolved(false);
      fetchProfile();
      fetchReports();
    } else {
      setIsRoleResolved(true);
    }
  }, [isSignedIn, location.pathname]);

  useEffect(() => {
    if (isSignedIn && effectiveRole === 'admin' && location.pathname === '/dashboard') {
      fetchAdminUsers();
    }
  }, [isSignedIn, effectiveRole, location.pathname]);

  useEffect(() => {
    setAdminSection('overview');
    setDoctorSection('overview');
    setPatientSection('overview');
  }, [effectiveRole]);

  const onSaveProfile = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      setLoading(true);
      const payload = { ...profileForm, age: profileForm.age ? Number(profileForm.age) : undefined };
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
              <div className="space-y-12">
                {/* Hero Section */}
                <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-2xl border border-white/10">
                  <div className="absolute top-0 right-0 -mr-20 -mt-20 w-72 h-72 rounded-full bg-blue-500/20 blur-[80px]"></div>
                  <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-purple-500/20 blur-[80px]"></div>
                  
                  <div className="relative z-10 p-10 md:p-20 text-center flex flex-col items-center">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-blue-200 text-sm font-medium mb-8 backdrop-blur-md">
                      <Activity size={16} /> Welcome to MediSync AI
                    </div>
                    
                    <h1 className="text-4xl md:text-5xl lg:text-7xl font-extrabold tracking-tight mb-6 text-transparent bg-clip-text bg-gradient-to-br from-white to-blue-200 drop-shadow-sm">
                      Elevate Your Health Management
                    </h1>
                    
                    <p className="max-w-2xl text-lg md:text-xl text-indigo-100/80 mb-10 leading-relaxed font-light">
                      Experience a seamless, secure, and intelligent way to store your medical records, manage your profile, and track your wellness journey in one unified platform.
                    </p>
                    
                    <div className="flex flex-wrap justify-center gap-4">
                      <SignedIn>
                        <Link to="/dashboard">
                          <button className="flex items-center gap-2 px-8 py-4 rounded-full bg-white text-indigo-900 font-bold hover:bg-blue-50 hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                            <Activity size={20} /> Go to Dashboard
                          </button>
                        </Link>
                        <Link to="/profile">
                          <button className="flex items-center gap-2 px-8 py-4 rounded-full bg-white/5 text-white font-bold hover:bg-white/10 border border-white/10 hover:scale-105 transition-all backdrop-blur-sm">
                            <User size={20} /> Profile Settings
                          </button>
                        </Link>
                      </SignedIn>

                      <SignedOut>
                        <Link to="/signup">
                          <button className="px-8 py-4 rounded-full bg-blue-600 text-white font-bold hover:bg-blue-500 hover:scale-105 transition-all shadow-[0_0_30px_rgba(37,99,235,0.3)]">
                            Get Started Instantly
                          </button>
                        </Link>
                        <Link to="/signin">
                          <button className="px-8 py-4 rounded-full bg-white/5 text-white font-bold hover:bg-white/10 border border-white/10 hover:scale-105 transition-all backdrop-blur-sm">
                            Sign In to Account
                          </button>
                        </Link>
                      </SignedOut>
                    </div>
                  </div>
                </div>

                {/* Features Section */}
                <div className="grid md:grid-cols-3 gap-6 md:gap-8">
                  <div className="group bg-white rounded-3xl p-8 shadow-xl shadow-gray-200/40 border border-gray-100 hover:-translate-y-2 hover:shadow-2xl hover:shadow-blue-100/50 transition-all duration-300">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center mb-6 shadow-lg shadow-blue-200/50 group-hover:scale-110 transition-transform">
                      <UploadCloud size={24} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3 tracking-tight">Secure Uploads</h3>
                    <p className="text-gray-500 leading-relaxed">Instantly upload and organize your medical prescriptions, lab reports, and imaging files with bank-grade security.</p>
                  </div>

                  <div className="group bg-white rounded-3xl p-8 shadow-xl shadow-gray-200/40 border border-gray-100 hover:-translate-y-2 hover:shadow-2xl hover:shadow-indigo-100/50 transition-all duration-300">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center mb-6 shadow-lg shadow-indigo-200/50 group-hover:scale-110 transition-transform">
                      <FileText size={24} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3 tracking-tight">Instant Access</h3>
                    <p className="text-gray-500 leading-relaxed">Retrieve and review your historical medical data anytime, anywhere seamlessly straight from your dashboard.</p>
                  </div>

                  <div className="group bg-white rounded-3xl p-8 shadow-xl shadow-gray-200/40 border border-gray-100 hover:-translate-y-2 hover:shadow-2xl hover:shadow-emerald-100/50 transition-all duration-300">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center mb-6 shadow-lg shadow-emerald-200/50 group-hover:scale-110 transition-transform">
                      <User size={24} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3 tracking-tight">Unified Profile</h3>
                    <p className="text-gray-500 leading-relaxed">Maintain a comprehensive health profile to ensure doctors and platforms always have your accurate details.</p>
                  </div>
                </div>
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
                ) : effectiveRole === 'admin' ? (
                  <div className="grid lg:grid-cols-[260px_1fr] gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Card className="p-4 border-slate-200/60 sticky top-24 h-max bg-white/80 backdrop-blur-xl">
                      <div className="mb-6 px-3">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Admin Panel</h3>
                        <p className="text-slate-800 font-semibold tracking-tight">Management Console</p>
                      </div>
                      <div className="space-y-1.5 focus:outline-none">
                        <button
                          type="button"
                          className={cn('w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-colors outline-none', adminSection === 'overview' ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100/50' : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:text-slate-900')}
                          onClick={() => setAdminSection('overview')}
                        >
                          <Shield size={18} className={adminSection === 'overview' ? 'text-indigo-600' : 'text-slate-400'} /> Dashboard Overview
                        </button>
                        {hasPrivilege('manage_user_accounts') && (
                          <button
                            type="button"
                            className={cn('w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-colors outline-none', adminSection === 'users' ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100/50' : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:text-slate-900')}
                            onClick={() => setAdminSection('users')}
                          >
                            <Users size={18} className={adminSection === 'users' ? 'text-indigo-600' : 'text-slate-400'} /> User Management
                          </button>
                        )}
                        {hasPrivilege('verify_doctor_registrations') && (
                          <button
                            type="button"
                            className={cn('w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-colors outline-none', adminSection === 'doctor-verification' ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100/50' : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:text-slate-900')}
                            onClick={() => setAdminSection('doctor-verification')}
                          >
                            <Stethoscope size={18} className={adminSection === 'doctor-verification' ? 'text-indigo-600' : 'text-slate-400'} /> Doctor Verification
                          </button>
                        )}
                        {hasPrivilege('platform_operations') && (
                          <button
                            type="button"
                            className={cn('w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-colors outline-none', adminSection === 'operations' ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100/50' : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:text-slate-900')}
                            onClick={() => setAdminSection('operations')}
                          >
                            <Settings size={18} className={adminSection === 'operations' ? 'text-indigo-600' : 'text-slate-400'} /> Platform Operations
                          </button>
                        )}
                        {hasPrivilege('manage_profile') && (
                          <button
                            type="button"
                            className={cn('w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-colors outline-none', adminSection === 'profile' ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100/50' : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:text-slate-900')}
                            onClick={() => setAdminSection('profile')}
                          >
                            <User size={18} className={adminSection === 'profile' ? 'text-indigo-600' : 'text-slate-400'} /> Admin Profile
                          </button>
                        )}
                      </div>
                    </Card>

                    <div className="space-y-8">
                      {adminSection === 'overview' && (
                        <>
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60">
                            <div>
                              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Admin Dashboard</h2>
                              <p className="text-slate-500 text-sm font-medium mt-1">Manage users and roles for the MediSync AI platform.</p>
                            </div>
                          </div>
                          
                          <div className="grid md:grid-cols-4 gap-6">
                            <Card className="p-6 relative overflow-hidden group">
                               <div className="h-1 bg-indigo-500 absolute top-0 left-0 w-full opacity-50"></div>
                              <p className="text-sm font-medium text-slate-500 mb-2">Total Users</p>
                              <p className="text-4xl font-extrabold text-slate-800 tracking-tight">{adminUsers.length}</p>
                            </Card>
                            <Card className="p-6 relative overflow-hidden group">
                               <div className="h-1 bg-emerald-500 absolute top-0 left-0 w-full opacity-50"></div>
                              <p className="text-sm font-medium text-slate-500 mb-2">Admins</p>
                              <p className="text-4xl font-extrabold text-emerald-600 tracking-tight">{adminUsers.filter((u) => u.role === 'admin').length}</p>
                            </Card>
                            <Card className="p-6 relative overflow-hidden group">
                               <div className="h-1 bg-amber-500 absolute top-0 left-0 w-full opacity-50"></div>
                              <p className="text-sm font-medium text-slate-500 mb-2">Doctors</p>
                              <p className="text-4xl font-extrabold text-amber-600 tracking-tight">{adminUsers.filter((u) => u.role === 'doctor').length}</p>
                            </Card>
                            <Card className="p-6 relative overflow-hidden group">
                               <div className="h-1 bg-blue-500 absolute top-0 left-0 w-full opacity-50"></div>
                              <p className="text-sm font-medium text-slate-500 mb-2">Patients</p>
                              <p className="text-4xl font-extrabold text-blue-600 tracking-tight">{adminUsers.filter((u) => (u.role || 'patient') === 'patient').length}</p>
                            </Card>
                          </div>
                        </>
                      )}

                      {adminSection === 'users' && (
                        <div className="space-y-6">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60">
                            <div>
                              <h3 className="text-xl font-bold text-slate-800 tracking-tight">Active Users</h3>
                              <p className="text-sm text-slate-500 font-medium mt-1">Manage system access, update details, or assign roles.</p>
                            </div>
                            <Button type="button" onClick={() => setIsCreateUserModalOpen(true)} disabled={loading} className="px-5 py-3 shadow-indigo-600/30 w-full sm:w-auto">
                              <Users size={18} /> Create New User
                            </Button>
                          </div>

                          <div className="grid gap-4">
                            {adminUsers.map((adminUser) => (
                              <div key={adminUser.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 group">
                                
                                <div className="flex items-center gap-4 min-w-0">
                                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center text-indigo-600 font-extrabold text-lg shrink-0 border border-indigo-200/50">
                                    {(adminUser.name || 'U').charAt(0).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className="font-bold text-slate-800 text-lg truncate flex items-center gap-2">
                                      {adminUser.name}
                                      <span className={cn(
                                        "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest",
                                        (adminUser.role || 'patient') === 'admin' ? "bg-emerald-100 text-emerald-700 border border-emerald-200" :
                                        (adminUser.role || 'patient') === 'doctor' ? "bg-amber-100 text-amber-700 border border-amber-200" : "bg-blue-100 text-blue-700 border border-blue-200"
                                      )}>
                                        {adminUser.role || 'patient'}
                                      </span>
                                    </h4>
                                    <div className="flex items-center gap-3 text-sm font-medium text-slate-500 mt-1">
                                      <span className="truncate flex items-center gap-1.5"><Activity size={14} className="text-slate-400" /> {adminUser.email?.endsWith('@clerk.local') ? <span className="italic text-slate-400">Syncing email…</span> : adminUser.email}</span>
                                      {adminUser.phone && <span className="hidden sm:flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded-md"><Smartphone size={14} className="text-slate-400" /> {adminUser.phone}</span>}
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-3 bg-slate-50 p-2 md:p-1.5 rounded-xl md:rounded-lg border border-slate-100 md:border-transparent md:bg-transparent">
                                  <select
                                    className="rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none cursor-pointer hover:border-indigo-300"
                                    value={adminUser.role || 'patient'}
                                    onChange={(e) => onChangeUserRole(adminUser.id, e.target.value)}
                                    disabled={loading}
                                  >
                                    <option value="patient">Patient Role</option>
                                    <option value="doctor">Doctor Role</option>
                                    <option value="admin">Admin Role</option>
                                  </select>
                                  <div className="w-px h-6 bg-slate-200 mx-1 hidden md:block"></div>
                                  <button type="button" className="text-slate-500 hover:text-indigo-600 p-2 rounded-lg hover:bg-indigo-50 transition-colors" onClick={() => onStartEditAdminUser(adminUser)} disabled={loading} title="Edit User">
                                    <Settings size={18} />
                                  </button>
                                  <button type="button" className="text-slate-500 hover:text-rose-600 p-2 rounded-lg hover:bg-rose-50 transition-colors" onClick={() => onDeleteAdminUser(adminUser.id)} disabled={loading} title="Delete User">
                                    <AlertCircle size={18} />
                                  </button>
                                </div>

                              </div>
                            ))}
                            {adminUsers.length === 0 && (
                              <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                                <Users className="mx-auto text-slate-300 mb-3" size={48} />
                                <h4 className="text-slate-800 font-bold mb-1">No users found</h4>
                                <p className="text-slate-500 text-sm">Create a new user to populate this directory.</p>
                              </div>
                            )}
                          </div>

                          {isCreateUserModalOpen && (
                            <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                              <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 md:p-8 animate-in zoom-in-95 duration-200">
                                <div className="flex items-center justify-between mb-8">
                                  <div>
                                    <h4 className="text-2xl font-bold text-slate-800 tracking-tight">Create New User</h4>
                                    <p className="text-slate-500 text-sm font-medium mt-1">Add a new patient, doctor, or administrator.</p>
                                  </div>
                                  <button type="button" className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors" onClick={() => setIsCreateUserModalOpen(false)}>✕</button>
                                </div>
                                <form onSubmit={onCreateAdminUser} className="grid md:grid-cols-2 gap-4">
                                  <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
                                    <Input placeholder="e.g. Jane Doe" value={adminNewUser.name} onChange={(e) => setAdminNewUser((prev) => ({ ...prev, name: e.target.value }))} required />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Username</label>
                                    <Input
                                      placeholder="e.g. jane.doe"
                                      value={adminNewUser.username}
                                      onChange={(e) => setAdminNewUser((prev) => ({ ...prev, username: e.target.value }))}
                                      required
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
                                    <Input type="email" placeholder="jane@example.com" value={adminNewUser.email} onChange={(e) => setAdminNewUser((prev) => ({ ...prev, email: e.target.value }))} required />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone Number</label>
                                    <Input placeholder="(555) 000-0000" value={adminNewUser.phone} onChange={(e) => setAdminNewUser((prev) => ({ ...prev, phone: e.target.value }))} />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Temporary Password</label>
                                    <Input
                                      type="password"
                                      minLength={8}
                                      placeholder="At least 8 characters"
                                      value={adminNewUser.password}
                                      onChange={(e) => setAdminNewUser((prev) => ({ ...prev, password: e.target.value }))}
                                      required
                                    />
                                  </div>
                                  <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Assign Role</label>
                                    <select
                                      className="block w-full rounded-xl border-slate-200 bg-slate-50/50 border py-3 px-4 text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 outline-none my-1"
                                      value={adminNewUser.role}
                                      onChange={(e) => setAdminNewUser((prev) => ({ ...prev, role: e.target.value }))}
                                    >
                                      <option value="patient">Patient (Default)</option>
                                      <option value="doctor">Doctor</option>
                                      <option value="admin">Administrator</option>
                                    </select>
                                  </div>
                                  <div className="md:col-span-2 flex justify-end gap-3 pt-6 border-t border-slate-100 mt-2">
                                    <Button type="button" variant="secondary" onClick={() => setIsCreateUserModalOpen(false)} disabled={loading}>Cancel</Button>
                                    <Button type="submit" disabled={loading} className="px-8 shadow-indigo-600/30">{loading ? 'Creating...' : 'Create Record'}</Button>
                                  </div>
                                </form>
                              </div>
                            </div>
                          )}

                          {isEditUserModalOpen && editingAdminUserId && (
                            <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                              <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 md:p-8 animate-in zoom-in-95 duration-200">
                                <div className="flex items-center justify-between mb-8">
                                  <div>
                                    <h4 className="text-2xl font-bold text-slate-800 tracking-tight">Edit User Profile</h4>
                                    <p className="text-slate-500 text-sm font-medium mt-1">Modify details for {adminEditForm.name || 'this user'}.</p>
                                  </div>
                                  <button type="button" className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors" onClick={onCancelEditAdminUser}>✕</button>
                                </div>
                                <form onSubmit={(e) => { e.preventDefault(); onSaveAdminUser(editingAdminUserId); }} className="grid md:grid-cols-2 gap-4">
                                  <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
                                    <Input placeholder="Update full name" value={adminEditForm.name} onChange={(e) => setAdminEditForm((prev) => ({ ...prev, name: e.target.value }))} required />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
                                    <Input type="email" placeholder="Update email" value={adminEditForm.email} onChange={(e) => setAdminEditForm((prev) => ({ ...prev, email: e.target.value }))} required />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone Number</label>
                                    <Input placeholder="Update phone" value={adminEditForm.phone} onChange={(e) => setAdminEditForm((prev) => ({ ...prev, phone: e.target.value }))} />
                                  </div>
                                  <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">User Role</label>
                                    <select 
                                      className="block w-full rounded-xl border-slate-200 bg-slate-50/50 border py-3 px-4 text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all my-1 outline-none" 
                                      value={adminEditForm.role} 
                                      onChange={(e) => setAdminEditForm((prev) => ({ ...prev, role: e.target.value }))}
                                    >
                                      <option value="patient">Patient</option>
                                      <option value="doctor">Doctor</option>
                                      <option value="admin">Administrator</option>
                                    </select>
                                  </div>
                                  <div className="md:col-span-2 flex justify-end gap-3 pt-6 border-t border-slate-100 mt-2">
                                    <Button type="button" variant="secondary" onClick={onCancelEditAdminUser} disabled={loading}>Cancel</Button>
                                    <Button type="submit" disabled={loading} className="px-8 shadow-indigo-600/30">{loading ? 'Saving...' : 'Save Changes'}</Button>
                                  </div>
                                </form>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {adminSection === 'doctor-verification' && hasPrivilege('verify_doctor_registrations') && (
                        <Card className="p-8 border border-slate-200/80 bg-white/80 backdrop-blur-xl">
                          <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Doctor Registration Verification</h3>
                          <p className="text-slate-500 font-medium text-sm mt-1">Approve or reject new doctor registrations after compliance checks.</p>
                          <div className="mt-6 p-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60">
                            <p className="text-slate-700 font-medium">Verification queue UI will be integrated here after merge.</p>
                          </div>
                        </Card>
                      )}

                      {adminSection === 'operations' && hasPrivilege('platform_operations') && (
                        <Card className="p-8 border border-slate-200/80 bg-white/80 backdrop-blur-xl">
                          <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Platform Operations</h3>
                          <p className="text-slate-500 font-medium text-sm mt-1">Monitor platform health, operational actions, and system-level controls.</p>
                          <div className="mt-6 p-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60">
                            <p className="text-slate-700 font-medium">Operations widgets can be merged into this safe role-gated section.</p>
                          </div>
                        </Card>
                      )}

                      {adminSection === 'profile' && (
                        <Card className="p-8 border border-slate-200/80 bg-white/80 backdrop-blur-xl">
                          <div className="mb-8">
                            <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Admin Profile Settings</h3>
                            <p className="text-slate-500 font-medium text-sm mt-1">Manage your administrative contact details and personal info.</p>
                          </div>
                          <form onSubmit={onSaveProfile} className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-x-6 gap-y-5">
                              <div className="md:col-span-2 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50 mb-2">
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Account Email (Verified via Clerk)</label>
                                <Input value={visibleEmail} readOnly disabled className="bg-white/50 border-slate-200 text-slate-600 mb-0 opacity-80 cursor-not-allowed" />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
                                <Input icon={User} placeholder="Enter your full name" value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} className="mb-0" />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contact Number</label>
                                <Input icon={Smartphone} placeholder="Enter phone number" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} className="mb-0" />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Age</label>
                                <Input icon={Calendar} type="number" min="0" placeholder="e.g. 35" value={profileForm.age} onChange={(e) => setProfileForm({ ...profileForm, age: e.target.value })} className="mb-0" />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Gender</label>
                                <select className="block w-full rounded-xl border-slate-200 bg-slate-50/50 border py-3 px-4 text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 outline-none my-1" value={profileForm.gender} onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}>
                                  <option value="">Select Gender</option>
                                  <option value="male">Male</option>
                                  <option value="female">Female</option>
                                  <option value="other">Other</option>
                                </select>
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Current Address</label>
                                <Input icon={MapPin} placeholder="Enter your full residential address" value={profileForm.address} onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })} className="mb-0" />
                              </div>
                            </div>
                            <div className="pt-6 mt-4 border-t border-slate-100 flex justify-end">
                              <Button type="submit" disabled={loading} className="w-full md:w-auto px-10 shadow-indigo-600/30 text-base py-3">
                                {loading ? 'Saving securely...' : 'Save Profile Details'}
                              </Button>
                            </div>
                          </form>
                        </Card>
                      )}
                    </div>
                  </div>
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
                              <p className="text-4xl font-extrabold text-slate-800 tracking-tight">12</p>
                            </Card>
                            <Card className="p-6 relative overflow-hidden group">
                              <div className="h-1 bg-amber-500 absolute top-0 left-0 w-full opacity-50"></div>
                              <div className="flex justify-between items-start mb-4">
                                <p className="font-medium text-slate-500">Pending Consults</p>
                                <div className="p-2 bg-amber-50 rounded-xl text-amber-600 group-hover:scale-110 transition-transform"><Activity size={20} /></div>
                              </div>
                              <p className="text-4xl font-extrabold text-slate-800 tracking-tight">5</p>
                            </Card>
                            <Card className="p-6 relative overflow-hidden group">
                              <div className="h-1 bg-emerald-500 absolute top-0 left-0 w-full opacity-50"></div>
                              <div className="flex justify-between items-start mb-4">
                                <p className="font-medium text-slate-500">Completed Today</p>
                                <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600 group-hover:scale-110 transition-transform"><Shield size={20} /></div>
                              </div>
                              <p className="text-4xl font-extrabold text-slate-800 tracking-tight">7</p>
                            </Card>
                          </div>

                          <Card className="border-t-4 border-t-slate-200">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 px-1">Upcoming Appointments</h3>
                            <ul className="flex flex-col gap-3">
                              {['10:00 AM - Follow-up consultation', '11:30 AM - New patient review', '02:00 PM - Telemedicine check-in'].map((apt, i) => (
                                <li key={i} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors">
                                  <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                  <span className="font-medium text-slate-700">{apt}</span>
                                </li>
                              ))}
                            </ul>
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
                        <button
                          type="button"
                          className={cn('w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-colors outline-none', patientSection === 'overview' ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100/50' : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:text-slate-900')}
                          onClick={() => setPatientSection('overview')}
                        >
                          <Activity size={18} className={patientSection === 'overview' ? 'text-indigo-600' : 'text-slate-400'} /> Dashboard Overview
                        </button>
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
                        {hasPrivilege('video_consultations') && (
                          <button
                            type="button"
                            className={cn('w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-colors outline-none', patientSection === 'consultations' ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100/50' : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:text-slate-900')}
                            onClick={() => setPatientSection('consultations')}
                          >
                            <Activity size={18} className={patientSection === 'consultations' ? 'text-indigo-600' : 'text-slate-400'} /> Video Consultations
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
                      {patientSection === 'overview' && (
                        <>
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60">
                            <div className="flex items-center gap-5">
                        <div className="h-16 w-16 bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-2xl shadow-md flex items-center justify-center text-2xl font-bold tracking-tight">
                          {(patient?.name || user?.firstName || 'P')?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Welcome back, {effectivePatientName}</h2>
                          <p className="text-slate-500 text-sm font-medium mt-1">Manage your health records securely.</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <Card className="p-6 relative overflow-hidden group">
                        <div className="h-1 bg-indigo-500 absolute top-0 left-0 w-full opacity-50"></div>
                        <div className="flex justify-between items-start mb-4">
                          <p className="font-medium text-slate-500">Upcoming Appointments</p>
                          <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600 group-hover:scale-110 transition-transform"><Calendar size={20} /></div>
                        </div>
                        <p className="text-4xl font-extrabold text-slate-800 tracking-tight">1</p>
                      </Card>
                      <Card className="p-6 relative overflow-hidden group">
                        <div className="h-1 bg-emerald-500 absolute top-0 left-0 w-full opacity-50"></div>
                        <div className="flex justify-between items-start mb-4">
                          <p className="font-medium text-slate-500">Medical Reports</p>
                          <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600 group-hover:scale-110 transition-transform"><FileText size={20} /></div>
                        </div>
                        <p className="text-4xl font-extrabold text-slate-800 tracking-tight">{reports.length}</p>
                      </Card>
                      <Card className="p-6 relative overflow-hidden group">
                        <div className="h-1 bg-amber-500 absolute top-0 left-0 w-full opacity-50"></div>
                        <div className="flex justify-between items-start mb-4">
                          <p className="font-medium text-slate-500">Active Prescriptions</p>
                          <div className="p-2 bg-amber-50 rounded-xl text-amber-600 group-hover:scale-110 transition-transform"><Activity size={20} /></div>
                        </div>
                        <p className="text-4xl font-extrabold text-slate-800 tracking-tight">2</p>
                      </Card>
                    </div>

                    <Card className="border-t-4 border-t-slate-200">
                      <h3 className="text-lg font-bold text-slate-800 mb-4 px-1">Next Appointment</h3>
                      <ul className="flex flex-col gap-3">
                        <li className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 hover:border-indigo-200 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0 border border-slate-100">
                               <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"></div>
                            </div>
                            <div>
                               <p className="font-bold text-slate-800">Dr. Sarah Connor</p>
                               <p className="text-sm font-medium text-slate-500">General Checkup</p>
                            </div>
                          </div>
                          <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200 text-sm font-bold text-indigo-600 shrink-0">
                             Tomorrow, 10:00 AM
                          </div>
                        </li>
                      </ul>
                    </Card>
                        </>
                      )}

                      {patientSection === 'doctors' && hasPrivilege('browse_doctors') && (
                        <Card className="p-8 border border-slate-200/80 bg-white/80 backdrop-blur-xl">
                          <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Browse Doctors</h3>
                          <p className="text-slate-500 font-medium text-sm mt-1">Find doctors by specialty and review available consultation slots.</p>
                          <div className="mt-6 p-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60">
                            <p className="text-slate-700 font-medium">Doctor listing module can be merged into this patient-only section.</p>
                          </div>
                        </Card>
                      )}

                      {patientSection === 'appointments' && hasPrivilege('book_appointments') && (
                        <Card className="p-8 border border-slate-200/80 bg-white/80 backdrop-blur-xl">
                          <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Book Appointments</h3>
                          <p className="text-slate-500 font-medium text-sm mt-1">Schedule appointments with your selected doctors.</p>
                          <div className="mt-6 p-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60">
                            <p className="text-slate-700 font-medium">Appointment booking component can be merged here safely.</p>
                          </div>
                        </Card>
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
                          <div className="mt-6 p-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60">
                            <p className="text-slate-700 font-medium">Prescription history component can be merged into this section.</p>
                          </div>
                        </Card>
                      )}

                      {patientSection === 'profile' && hasPrivilege('manage_profile') && (
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

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
