import { createContext, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";

export const AdminContext = createContext();

const AdminContextProvider = (props) => {
    const [aToken, setAToken] = useState(localStorage.getItem('aToken') ? localStorage.getItem('aToken') : '');
    const [dashData, setDashData] = useState(false);
    const [doctors, setDoctors] = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [adminEmail, setAdminEmail] = useState(localStorage.getItem('adminEmail') || '');
    
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
    const gatewayUrl = 'http://localhost:8000';

    const getDashData = async () => {
        try {
            const { data } = await axios.get(backendUrl + '/api/admin/dashboard', { headers: { atoken: aToken } });

            if (data.success) {
                setDashData(data.dashData);
                console.log(data.dashData);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            console.log(error);
            toast.error(error.message);
        }
    }

    const getAllDoctors = async () => {
        try {
            const { data } = await axios.post(backendUrl + '/api/admin/all-doctors', {}, { headers: { atoken: aToken } });
            if (data.success) {
                setDoctors(data.doctors);
                console.log(data.doctors);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    }

    const changeAvailability = async (docId) => {
        try {
            const { data } = await axios.post(backendUrl + '/api/admin/change-availability', { docId }, { headers: { atoken: aToken } });
            if (data.success) {
                toast.success(data.message);
                getAllDoctors();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    }

    const updateDoctor = async (formData) => {
        try {
            const { data } = await axios.post(backendUrl + '/api/admin/update-doctor', formData, { headers: { atoken: aToken } });
            if (data.success) {
                toast.success(data.message);
                getAllDoctors();
                return true;
            } else {
                toast.error(data.message);
                return false;
            }
        } catch (error) {
            toast.error(error.message);
            return false;
        }
    }

    const deleteDoctor = async (docId) => {
        try {
            const { data } = await axios.post(backendUrl + '/api/admin/delete-doctor', { docId }, { headers: { atoken: aToken } });
            if (data.success) {
                toast.success(data.message);
                getAllDoctors();
                return true;
            } else {
                toast.error(data.message);
                return false;
            }
        } catch (error) {
            toast.error(error.message);
            return false;
        }
    }

    const getAllAppointments = async () => {
        try {
            const { data } = await axios.get(gatewayUrl + '/api/appointments', { headers: { atoken: aToken } });
            if (data.appointments) {
                setAppointments(data.appointments);
                console.log(data.appointments);
            } else {
                toast.error(data.message || "Failed to fetch appointments");
            }
        } catch (error) {
            toast.error(error.message);
        }
    }

    const cancelAppointment = async (appointmentId) => {
        try {
            const { data } = await axios.patch(gatewayUrl + `/api/appointments/${appointmentId}/cancel`, {}, { headers: { atoken: aToken } });
            if (data.appointment) {
                toast.success("Appointment cancelled");
                getAllAppointments();
            } else {
                toast.error(data.message || "Failed to cancel appointment");
            }
        } catch (error) {
            toast.error(error.message);
        }
    }

    const logout = () => {
        setAToken('');
        setAdminEmail('');
        localStorage.removeItem('aToken');
        localStorage.removeItem('adminEmail');
        toast.info("Logged out successfully");
    }

    const value = {
        aToken, setAToken,
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
        adminEmail,
        logout
    };

    return (
        <AdminContext.Provider value={value}>
            {props.children}
        </AdminContext.Provider>
    );
};

export default AdminContextProvider;
