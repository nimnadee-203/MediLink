import { createContext, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";

export const AdminContext = createContext();

const AdminContextProvider = (props) => {
    // Assuming you have your token stored in localStorage and backend URL in env
    const [aToken, setAToken] = useState(localStorage.getItem('aToken') ? localStorage.getItem('aToken') : '');
    const [dashData, setDashData] = useState(false);
    
    // Replace with your actual backend URL depending on your Vite config
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

    // Getting Admin Dashboard data from Database using API
    const getDashData = async () => {
        try {
            const { data } = await axios.get(backendUrl + '/api/admin/dashboard', { headers: { aToken } });

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

    const value = {
        aToken, setAToken,
        backendUrl,
        dashData,
        getDashData
    };

    return (
        <AdminContext.Provider value={value}>
            {props.children}
        </AdminContext.Provider>
    );
};

export default AdminContextProvider;