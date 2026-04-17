import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useAuth, useClerk, useUser } from "@clerk/clerk-react";
import { toast } from "react-toastify";

export const AdminContext = createContext();

const AdminContextProvider = (props) => {
    const { isSignedIn, getToken } = useAuth();
    const { signOut } = useClerk();
    const { user } = useUser();
    const initializedUserRef = useRef('');

    const [loading, setLoading] = useState(false);
    const [adminUsers, setAdminUsers] = useState([]);
    const [profileForm, setProfileForm] = useState({ name: '', phone: '', age: '', gender: '', address: '' });
    const [currentAccountRole, setCurrentAccountRole] = useState('');
    const [currentAccountSource, setCurrentAccountSource] = useState('');
    const [profileLoaded, setProfileLoaded] = useState(false);

    const [aToken, setAToken] = useState('');
    const [dToken, setDToken] = useState(localStorage.getItem('dToken') || '');
    const [dashData, setDashData] = useState(false);
    const [doctors, setDoctors] = useState([]);
    const [appointments, setAppointments] = useState([]);

    const doctorApiBaseUrl = import.meta.env.VITE_DOCTOR_API_BASE_URL || 'http://localhost:8000/api/doctor';
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
    const gatewayUrl = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:8000';
    const apiBaseUrl = `${gatewayUrl}/api/patients`;

    const doctorAdminEmail = import.meta.env.VITE_DOCTOR_ADMIN_EMAIL || 'admin@medisync.com';
    const doctorAdminPassword = import.meta.env.VITE_DOCTOR_ADMIN_PASSWORD || 'Admin32';

    const clerkDisplayName =
        user?.fullName ||
        [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
        '';
    const clerkEmail = user?.primaryEmailAddress?.emailAddress || '';
    const clerkPhone = user?.primaryPhoneNumber?.phoneNumber || '';

    const request = useCallback(async (path, options = {}) => {
        const token = await getToken();
        const headers = {
            ...(options.headers || {}),
            ...(clerkEmail ? { 'x-clerk-email': clerkEmail } : {}),
            ...(clerkDisplayName ? { 'x-clerk-name': clerkDisplayName } : {}),
            ...(clerkPhone ? { 'x-clerk-phone': clerkPhone } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        };

        const response = await fetch(`${apiBaseUrl}${path}`, {
            ...options,
            headers
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.message || `Request failed (${response.status})`);
        }

        return data;
    }, [apiBaseUrl, getToken, clerkEmail, clerkDisplayName, clerkPhone]);

    const ensureDoctorAdminToken = useCallback(async () => {
        if (!isSignedIn || aToken) {
            return aToken;
        }

        try {
            const { data } = await axios.post(`${backendUrl}/api/admin/login`, {
                email: doctorAdminEmail,
                password: doctorAdminPassword
            });

            if (data?.success && data?.token) {
                setAToken(data.token);
                return data.token;
            }

            return '';
        } catch {
            return '';
        }
    }, [isSignedIn, aToken, backendUrl, doctorAdminEmail, doctorAdminPassword]);

    const detectDoctorAccess = useCallback(async () => {
        try {
            const token = await getToken();
            const headers = {
                ...(dToken ? { dtoken: dToken } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(clerkEmail ? { 'x-clerk-email': clerkEmail } : {}),
                ...(clerkDisplayName ? { 'x-clerk-name': clerkDisplayName } : {}),
                ...(clerkPhone ? { 'x-clerk-phone': clerkPhone } : {})
            };

            if (!headers.dtoken && !headers.Authorization) {
                return false;
            }

            const { data } = await axios.get(`${backendUrl}/api/doctor/appointments/upcoming`, {
                headers,
                timeout: 8000
            });

            return Boolean(data?.success);
        } catch {
            return false;
        }
    }, [getToken, dToken, clerkEmail, clerkDisplayName, clerkPhone, backendUrl]);

    const fetchProfile = useCallback(async () => {
        if (!isSignedIn) return null;

        try {
            const data = await request('/profile');
            const profile = data?.patient || data?.user || data?.profile || null;
            if (!profile) {
                setCurrentAccountRole('');
                setCurrentAccountSource('');
                setProfileLoaded(true);
                return null;
            }

            const profileName =
                profile?.name && profile.name !== 'Clerk User'
                    ? profile.name
                    : clerkDisplayName;

            setProfileForm({
                name: profileName || '',
                phone: profile?.phone || clerkPhone || '',
                age: profile?.age || '',
                gender: profile?.gender || '',
                address: profile?.address || ''
            });

            let resolvedRole = profile?.role || '';
            let resolvedSource = profile?.source || '';

            if (resolvedRole !== 'admin' && resolvedRole !== 'doctor') {
                const hasDoctorAccess = await detectDoctorAccess();
                if (hasDoctorAccess) {
                    resolvedRole = 'doctor';
                    resolvedSource = 'doctor-db';
                }
            }

            setCurrentAccountRole(resolvedRole);
            setCurrentAccountSource(resolvedSource);
            setProfileLoaded(true);
            return profile;
        } catch (error) {
            toast.error(error.message || 'Failed to load profile');
            setCurrentAccountRole('');
            setCurrentAccountSource('');
            setProfileLoaded(true);
            return null;
        }
    }, [isSignedIn, request, clerkDisplayName, clerkPhone, detectDoctorAccess]);

    const getDoctorAuthHeaders = useCallback(async () => {
        if (dToken) {
            return { dtoken: dToken };
        }

        const token = await getToken();
        return {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(clerkEmail ? { 'x-clerk-email': clerkEmail } : {}),
            ...(clerkDisplayName ? { 'x-clerk-name': clerkDisplayName } : {}),
            ...(clerkPhone ? { 'x-clerk-phone': clerkPhone } : {})
        };
    }, [dToken, getToken, clerkEmail, clerkDisplayName, clerkPhone]);

    const saveProfile = useCallback(async () => {
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
            await request('/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            toast.success('Profile updated successfully');
            return true;
        } catch (error) {
            toast.error(error.message || 'Profile update failed');
            return false;
        } finally {
            setLoading(false);
        }
    }, [profileForm, request]);

    const fetchAdminUsers = useCallback(async () => {
        if (!isSignedIn) return;

        try {
            setLoading(true);
            const [patientResponse, doctorResponse] = await Promise.allSettled([
                request('/admin/users'),
                fetch(`${doctorApiBaseUrl}/list`).then(async (res) => {
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                        throw new Error(data.message || `Failed loading doctors (${res.status})`);
                    }
                    return data;
                })
            ]);

            let patientUsersPayload = null;

            if (patientResponse.status === 'fulfilled') {
                patientUsersPayload = patientResponse.value;
            } else {
                const token = await ensureDoctorAdminToken();
                if (!token) {
                    throw patientResponse.reason;
                }

                const fallbackResponse = await axios.get(`${gatewayUrl}/api/patients/admin/users`, {
                    headers: { atoken: token }
                });

                patientUsersPayload = fallbackResponse.data || {};
            }

            const dbUsers = Array.isArray(patientUsersPayload?.users)
                ? patientUsersPayload.users.map((user) => {
                    const source = user.source || 'patient-db';
                    const sourceLabel = source === 'admin-db' ? 'Admin DB' : 'Patient DB';
                    return {
                        ...user,
                        id: String(user.id),
                        uid: `${source}:${user.id}`,
                        source,
                        sourceLabel,
                        editable: source !== 'doctor-db'
                    };
                })
                : [];

            const doctorUsers = doctorResponse.status === 'fulfilled' && Array.isArray(doctorResponse.value?.doctors)
                ? doctorResponse.value.doctors.map((doctor) => ({
                    id: String(doctor._id),
                    uid: `doctor:${doctor._id}`,
                    name: doctor.name || 'Doctor',
                    username: doctor.email ? doctor.email.split('@')[0] : '',
                    email: doctor.email || '',
                    role: 'doctor',
                    phone: doctor.phone || '',
                    createdAt: doctor.createdAt || null,
                    updatedAt: doctor.updatedAt || null,
                    source: 'doctor-db',
                    sourceLabel: 'Doctor DB',
                    editable: false,
                    speciality: doctor.speciality || ''
                }))
                : [];

            const doctorEmailSet = new Set(
                doctorUsers
                    .map((item) => String(item.email || '').trim().toLowerCase())
                    .filter(Boolean)
            );

            const normalizedDbUsers = dbUsers.map((user) => {
                const email = String(user.email || '').trim().toLowerCase();
                if (!email || !doctorEmailSet.has(email)) {
                    return user;
                }

                return {
                    ...user,
                    role: 'doctor',
                    source: 'doctor-db',
                    sourceLabel: 'Doctor DB',
                    editable: false,
                    uid: user.uid || `doctor-shadow:${user.id}`
                };
            });

            const dedupeUsers = [...normalizedDbUsers, ...doctorUsers].reduce((acc, user) => {
                const emailKey = String(user.email || '').trim().toLowerCase();
                const key = emailKey || user.uid || String(user.id);
                const current = acc.get(key);

                if (!current) {
                    acc.set(key, user);
                    return acc;
                }

                const currentIsDoctor = current.source === 'doctor-db';
                const nextIsDoctor = user.source === 'doctor-db';

                if (!currentIsDoctor && nextIsDoctor) {
                    acc.set(key, user);
                }

                return acc;
            }, new Map());

            const mergedUsers = Array.from(dedupeUsers.values()).sort((a, b) => {
                const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return bTime - aTime;
            });

            setAdminUsers(mergedUsers);

            if (doctorResponse.status === 'rejected') {
                console.warn('Doctor accounts temporarily unavailable:', doctorResponse.reason);
            }
        } catch (error) {
            toast.error(error.message || 'Failed to load users');
        } finally {
            setLoading(false);
        }
    }, [isSignedIn, request, doctorApiBaseUrl, ensureDoctorAdminToken, gatewayUrl]);

    const updateUserRole = useCallback(async (userId, role) => {
        const targetUser = adminUsers.find((item) => String(item.id) === String(userId));
        if (targetUser && targetUser.source === 'doctor-db') {
            toast.info('This account is managed in Doctor DB and is read-only here.');
            return false;
        }

        try {
            setLoading(true);
            await request(`/admin/users/${userId}/role`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role })
            });
            await fetchAdminUsers();
            toast.success('User role updated successfully');
            return true;
        } catch (error) {
            toast.error(error.message || 'Failed to update role');
            return false;
        } finally {
            setLoading(false);
        }
    }, [adminUsers, fetchAdminUsers, request]);

    const createAdminUser = useCallback(async (payload) => {
        try {
            setLoading(true);
            await request('/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            await fetchAdminUsers();
            toast.success('User created successfully');
            return true;
        } catch (error) {
            toast.error(error.message || 'Failed to create user');
            return false;
        } finally {
            setLoading(false);
        }
    }, [fetchAdminUsers, request]);

    const updateAdminUser = useCallback(async (userId, payload) => {
        const targetUser = adminUsers.find((item) => String(item.id) === String(userId));
        if (targetUser && targetUser.source === 'doctor-db') {
            toast.info('This account is managed in Doctor DB and is read-only here.');
            return false;
        }

        try {
            setLoading(true);
            await request(`/admin/users/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            await fetchAdminUsers();
            toast.success('User updated successfully');
            return true;
        } catch (error) {
            toast.error(error.message || 'Failed to update user');
            return false;
        } finally {
            setLoading(false);
        }
    }, [adminUsers, fetchAdminUsers, request]);

    const deleteAdminUser = useCallback(async (userId) => {
        const targetUser = adminUsers.find((item) => String(item.id) === String(userId));
        if (targetUser && targetUser.source === 'doctor-db') {
            toast.info('This account is managed in Doctor DB and is read-only here.');
            return false;
        }

        try {
            setLoading(true);
            await request(`/admin/users/${userId}`, {
                method: 'DELETE'
            });
            await fetchAdminUsers();
            toast.success('User deleted successfully');
            return true;
        } catch (error) {
            toast.error(error.message || 'Failed to delete user');
            return false;
        } finally {
            setLoading(false);
        }
    }, [adminUsers, fetchAdminUsers, request]);

    const getDashData = useCallback(async () => {
        try {
            const token = await ensureDoctorAdminToken();

            if (token) {
                const { data } = await axios.get(`${backendUrl}/api/admin/dashboard`, {
                    headers: { atoken: token }
                });
                if (data?.success) {
                    setDashData(data.dashData || false);
                    return;
                }
            }

            const authToken = await getToken();
            if (!authToken) {
                return;
            }

            const [appointmentsRes, doctorsRes] = await Promise.all([
                axios.get(`${gatewayUrl}/api/appointments`, {
                    headers: { Authorization: `Bearer ${authToken}` }
                }).catch(() => ({ data: { appointments: [] } })),
                fetch(`${doctorApiBaseUrl}/list`).then(async (res) => {
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                        throw new Error(data.message || 'Failed loading doctors');
                    }
                    return data;
                }).catch(() => ({ doctors: [] }))
            ]);

            const appointmentsList = Array.isArray(appointmentsRes?.data?.appointments) ? appointmentsRes.data.appointments : [];
            const doctorsList = Array.isArray(doctorsRes?.doctors) ? doctorsRes.doctors : [];

            setDashData({
                doctors: doctorsList.length,
                appoiments: appointmentsList.length,
                patients: adminUsers.filter((item) => item.source !== 'doctor-db').length,
                latestAppoiments: appointmentsList.slice(0, 5)
            });
        } catch {
        }
    }, [backendUrl, ensureDoctorAdminToken, getToken, gatewayUrl, doctorApiBaseUrl, adminUsers]);

    const getAllDoctors = useCallback(async () => {
        try {
            const token = await ensureDoctorAdminToken();

            if (token) {
                const { data } = await axios.post(`${backendUrl}/api/admin/all-doctors`, {}, {
                    headers: { atoken: token }
                });
                if (data?.success) {
                    setDoctors(Array.isArray(data.doctors) ? data.doctors : []);
                    return;
                }
            }

            const fallback = await fetch(`${doctorApiBaseUrl}/list`).then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(data.message || `Failed loading doctors (${res.status})`);
                }
                return data;
            });

            setDoctors(Array.isArray(fallback?.doctors) ? fallback.doctors : []);
        } catch {
        }
    }, [backendUrl, ensureDoctorAdminToken, doctorApiBaseUrl]);

    const changeAvailability = useCallback(async (docId) => {
        const token = await ensureDoctorAdminToken();
        if (!token) return;

        try {
            const { data } = await axios.post(`${backendUrl}/api/admin/change-availability`, { docId }, {
                headers: { atoken: token }
            });
            if (data?.success) {
                await getAllDoctors();
            }
        } catch {
        }
    }, [backendUrl, ensureDoctorAdminToken, getAllDoctors]);

    const updateDoctor = useCallback(async (formData) => {
        const token = await ensureDoctorAdminToken();
        if (!token) {
            toast.error('Doctor admin token unavailable');
            return false;
        }

        try {
            const { data } = await axios.post(`${backendUrl}/api/admin/update-doctor`, formData, {
                headers: { atoken: token }
            });
            if (data?.success) {
                toast.success(data.message || 'Doctor updated');
                await getAllDoctors();
                return true;
            }
            toast.error(data?.message || 'Failed to update doctor');
            return false;
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
            return false;
        }
    }, [backendUrl, ensureDoctorAdminToken, getAllDoctors]);

    const deleteDoctor = useCallback(async (docId) => {
        const token = await ensureDoctorAdminToken();
        if (!token) {
            toast.error('Doctor admin token unavailable');
            return false;
        }

        try {
            const { data } = await axios.post(`${backendUrl}/api/admin/delete-doctor`, { docId }, {
                headers: { atoken: token }
            });
            if (data?.success) {
                toast.success(data.message || 'Doctor deleted');
                await getAllDoctors();
                return true;
            }
            toast.error(data?.message || 'Failed to delete doctor');
            return false;
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
            return false;
        }
    }, [backendUrl, ensureDoctorAdminToken, getAllDoctors]);

    const getAllAppointments = useCallback(async () => {
        try {
            const token = await ensureDoctorAdminToken();
            let headers = {};

            if (token) {
                headers = { atoken: token };
            } else {
                const clerkToken = await getToken();
                if (!clerkToken) {
                    return;
                }
                headers = { Authorization: `Bearer ${clerkToken}` };
            }

            const { data } = await axios.get(`${gatewayUrl}/api/appointments`, {
                headers
            });
            if (Array.isArray(data?.appointments)) {
                setAppointments(data.appointments);
            }
        } catch {
        }
    }, [gatewayUrl, ensureDoctorAdminToken, getToken]);

    const cancelAppointment = useCallback(async (appointmentId) => {
        try {
            const token = await ensureDoctorAdminToken();
            let headers = {};

            if (token) {
                headers = { atoken: token };
            } else {
                const clerkToken = await getToken();
                if (!clerkToken) {
                    return;
                }
                headers = { Authorization: `Bearer ${clerkToken}` };
            }

            await axios.patch(`${gatewayUrl}/api/appointments/${appointmentId}/cancel`, {}, {
                headers
            });
            await getAllAppointments();
            await getDashData();
            toast.success('Appointment cancelled');
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        }
    }, [gatewayUrl, ensureDoctorAdminToken, getToken, getAllAppointments, getDashData]);

    const logout = useCallback(() => {
        setAToken('');
        setDToken('');
        localStorage.removeItem('dToken');
        signOut({ redirectUrl: '/signin' });
    }, [signOut]);

    useEffect(() => {
        const initialize = async () => {
            const signedInUserId = user?.id || '';
            if (signedInUserId && initializedUserRef.current === signedInUserId && profileLoaded) {
                return;
            }

            initializedUserRef.current = signedInUserId;
            setProfileLoaded(false);

            const profile = await fetchProfile();
            const role = profile?.role || '';
            const source = profile?.source || '';
            const canAccessAdmin = role === 'admin' || source === 'admin-db';

            if (!canAccessAdmin) {
                setAdminUsers([]);
                setAToken('');
                setDoctors([]);
                setAppointments([]);
                setDashData(false);
                return;
            }

            await fetchAdminUsers();
            ensureDoctorAdminToken();
        };

        if (!isSignedIn) {
            initializedUserRef.current = '';
            setAdminUsers([]);
            setProfileForm({ name: '', phone: '', age: '', gender: '', address: '' });
            setAToken('');
            setDToken('');
            localStorage.removeItem('dToken');
            setDoctors([]);
            setAppointments([]);
            setDashData(false);
            setCurrentAccountRole('');
            setCurrentAccountSource('');
            setProfileLoaded(true);
            return;
        }

        initialize();
    }, [isSignedIn, user?.id, profileLoaded, fetchProfile, fetchAdminUsers, ensureDoctorAdminToken]);

    const isAdminUser = currentAccountRole === 'admin' || currentAccountSource === 'admin-db';
    const isDoctorUser = currentAccountRole === 'doctor';

    const value = useMemo(() => ({
        loading,
        adminUsers,
        fetchAdminUsers,
        updateUserRole,
        createAdminUser,
        updateAdminUser,
        deleteAdminUser,
        profileForm,
        setProfileForm,
        saveProfile,
        logout,
        clerkEmail,
        clerkDisplayName,
        adminEmail: clerkEmail || 'admin@medisync.ai',
        isSignedIn,
        isAdminUser,
        isDoctorUser,
        profileLoaded,
        aToken,
        setAToken,
        dToken,
        setDToken,
        backendUrl,
        dashData,
        getDashData,
        doctors,
        getAllDoctors,
        changeAvailability,
        updateDoctor,
        deleteDoctor,
        appointments,
        getAllAppointments,
        cancelAppointment,
        getDoctorAuthHeaders
    }), [
        loading,
        adminUsers,
        fetchAdminUsers,
        updateUserRole,
        createAdminUser,
        updateAdminUser,
        deleteAdminUser,
        profileForm,
        setProfileForm,
        saveProfile,
        logout,
        clerkEmail,
        clerkDisplayName,
        isSignedIn,
        isAdminUser,
        isDoctorUser,
        profileLoaded,
        aToken,
        dToken,
        backendUrl,
        dashData,
        getDashData,
        doctors,
        getAllDoctors,
        changeAvailability,
        updateDoctor,
        deleteDoctor,
        appointments,
        getAllAppointments,
        cancelAppointment,
        getDoctorAuthHeaders
    ]);

    return (
        <AdminContext.Provider value={value}>
            {props.children}
        </AdminContext.Provider>
    );
};

export default AdminContextProvider;
