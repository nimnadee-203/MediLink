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
  Smartphone,
  MapPin,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SignIn, SignUp, SignedIn, SignedOut, UserButton, useAuth, useUser } from '@clerk/clerk-react';

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
  <div className={cn('bg-white rounded-2xl shadow-xl border border-gray-100 p-8', className)}>
    {children}
  </div>
);

const Input = ({ icon: Icon, ...props }) => (
  <div className="relative mb-4">
    {Icon && (
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
        <Icon size={20} />
      </div>
    )}
    <input
      className={cn(
        'block w-full rounded-lg border-gray-300 bg-gray-50 border py-3 px-4 text-gray-900 focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all duration-200 outline-none',
        Icon && 'pl-10'
      )}
      {...props}
    />
  </div>
);

const Button = ({ children, variant = 'primary', className, ...props }) => {
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg',
    secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-800'
  };
  return (
    <button
      className={cn(
        'flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50',
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
  const { user } = useUser();

  const clerkDisplayName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
    '';
  const clerkEmail = user?.primaryEmailAddress?.emailAddress || '';
  const clerkPhone = user?.primaryPhoneNumber?.phoneNumber || '';

  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [reports, setReports] = useState([]);
  const [editingReportId, setEditingReportId] = useState(null);
  const [editingReportForm, setEditingReportForm] = useState({ title: '', description: '' });

  const patientEmail = patient?.email || '';
  const visibleEmail =
    clerkEmail ||
    (patientEmail && !patientEmail.endsWith('@clerk.local') ? patientEmail : '');

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

  useEffect(() => {
    if (isSignedIn) {
      fetchProfile();
      fetchReports();
    } else {
      setPatient(null);
      setReports([]);
      setMessage('');
      setProfileForm({ name: '', phone: '', age: '', gender: '', address: '' });
      setReportForm({ title: '', description: '', file: null });
    }
  }, [isSignedIn]);

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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 w-full h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <Activity size={24} />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
              MediSync AI
            </span>
          </div>

          <div className="flex gap-4 items-center">
            <SignedIn>
              <Link to="/dashboard">
                <Button variant={location.pathname === '/dashboard' ? 'primary' : 'secondary'} className="px-4 py-2 text-sm rounded-lg">
                  <Activity size={18} /> Dashboard
                </Button>
              </Link>
              <Link to="/profile">
                <Button variant={location.pathname === '/profile' ? 'primary' : 'secondary'} className="px-4 py-2 text-sm rounded-lg">
                  <User size={18} /> Profile
                </Button>
              </Link>
              <UserButton afterSignOutUrl="/signin" />
            </SignedIn>

            <SignedOut>
              <Link to="/signin">
                <Button variant={location.pathname === '/signin' ? 'primary' : 'secondary'} className="px-4 py-2 text-sm rounded-lg">Sign In</Button>
              </Link>
              <Link to="/signup">
                <Button variant={location.pathname === '/signup' ? 'primary' : 'secondary'} className="px-4 py-2 text-sm rounded-lg">Sign Up</Button>
              </Link>
            </SignedOut>
          </div>
        </div>
      </nav>

      <main className="flex-1 w-full max-w-4xl mx-auto p-6 md:p-12">
        {message && (
          <div className={cn(
            'mb-8 p-4 rounded-xl flex items-center gap-3 font-medium',
            message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          )}>
            <AlertCircle size={20} />
            {message.text}
          </div>
        )}

        <Routes>
          <Route
            path="/signin/*"
            element={
              isSignedIn ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <div className="max-w-md mx-auto">
                  <Card className="p-4 md:p-6">
                    <SignIn routing="path" path="/signin" signUpUrl="/signup" />
                  </Card>
                </div>
              )
            }
          />

          <Route
            path="/signup/*"
            element={
              isSignedIn ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <div className="max-w-md mx-auto">
                  <Card className="p-4 md:p-6">
                    <SignUp routing="path" path="/signup" signInUrl="/signin" />
                  </Card>
                </div>
              )
            }
          />

          <Route
            path="/dashboard"
            element={
              isSignedIn ? (
                <div className="space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold">
                      {(patient?.name || user?.firstName || 'P')?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold text-gray-900">Welcome, {effectivePatientName}</h2>
                      <p className="text-gray-500 text-lg">Manage your health records and reports.</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8">
                    <Card>
                      <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <UploadCloud className="text-blue-600" /> Upload New Report
                      </h3>
                      <form onSubmit={onUploadReport} className="space-y-4">
                        <Input placeholder="Report Title (e.g. Blood Test)" value={reportForm.title} onChange={(e) => setReportForm({ ...reportForm, title: e.target.value })} required />
                        <Input placeholder="Brief Description" value={reportForm.description} onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })} />
                        <div className="relative border-2 border-dashed border-gray-300 bg-gray-50 rounded-xl p-6 hover:bg-gray-100 transition-colors text-center cursor-pointer">
                          <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => setReportForm({ ...reportForm, file: e.target.files?.[0] || null })} required />
                          <FileText className="mx-auto text-gray-400 mb-2" size={32} />
                          <span className="text-sm font-medium text-blue-600">
                            {reportForm.file ? reportForm.file.name : 'Click or drag file to upload'}
                          </span>
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                          {loading ? 'Uploading...' : 'Upload Document'}
                        </Button>
                      </form>
                    </Card>

                    <Card>
                      <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <FileText className="text-blue-600" /> My Reports
                      </h3>
                      {reports.length === 0 ? (
                        <div className="text-center py-12 px-4 border border-gray-100 rounded-xl bg-gray-50">
                          <FileText className="mx-auto text-gray-300 mb-3" size={48} />
                          <p className="text-gray-500 font-medium">No reports uploaded yet.</p>
                        </div>
                      ) : (
                        <ul className="space-y-3">
                          {reports.map((report) => (
                            <li key={report._id || report.fileName} className="p-4 rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all bg-white flex items-start gap-4">
                              <div className="bg-blue-50 text-blue-600 p-3 rounded-lg">
                                <FileText size={24} />
                              </div>
                              <div className="flex-1 min-w-0">
                                {editingReportId === report._id ? (
                                  <div className="space-y-2">
                                    <Input
                                      placeholder="Report title"
                                      value={editingReportForm.title}
                                      onChange={(e) => setEditingReportForm((prev) => ({ ...prev, title: e.target.value }))}
                                    />
                                    <Input
                                      placeholder="Brief description"
                                      value={editingReportForm.description}
                                      onChange={(e) => setEditingReportForm((prev) => ({ ...prev, description: e.target.value }))}
                                    />
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Button
                                        type="button"
                                        className="px-3 py-2 text-sm"
                                        onClick={() => onSaveEditReport(report._id)}
                                        disabled={loading}
                                      >
                                        Save
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        className="px-3 py-2 text-sm"
                                        onClick={onCancelEditReport}
                                        disabled={loading}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <h4 className="font-semibold text-gray-900 truncate">{report.title || 'Untitled Report'}</h4>
                                    <p className="text-sm text-gray-500 truncate">{report.fileName}</p>
                                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                      {report.description?.trim() || 'No description added.'}
                                    </p>
                                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm font-semibold">
                                      {getReportPreviewUrl(report) && (
                                        <a
                                          href={getReportPreviewUrl(report)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-blue-600 hover:text-blue-700"
                                        >
                                          Preview
                                        </a>
                                      )}
                                      {report._id && (
                                        <button
                                          type="button"
                                          className="text-indigo-600 hover:text-indigo-700"
                                          onClick={() => onStartEditReport(report)}
                                          disabled={loading}
                                        >
                                          Edit
                                        </button>
                                      )}
                                      {report._id && (
                                        <button
                                          type="button"
                                          className="text-red-600 hover:text-red-700"
                                          onClick={() => onDeleteReport(report._id)}
                                          disabled={loading}
                                        >
                                          Delete
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
                    </Card>
                  </div>
                </div>
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

          <Route path="/" element={<Navigate to={isSignedIn ? '/dashboard' : '/signin'} replace />} />
          <Route path="*" element={<Navigate to={isSignedIn ? '/dashboard' : '/signin'} replace />} />
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
