import React, { useContext } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Appointments from './pages/Appointments';
import AddDoctor from './pages/AddDoctor';
import DoctorList from './pages/DoctorList';
import DoctorProfile from './pages/DoctorProfile';
import DoctorHome from './pages/DoctorHome';
import Login from './pages/Login';
import { AdminContext } from './context/AdminContext';

function App() {
  const { aToken, dToken } = useContext(AdminContext);

  if (!aToken && !dToken) {
    return (
      <>
        <ToastContainer />
        <Login />
      </>
    );
  }

  if (dToken && !aToken) {
    return (
      <>
        <ToastContainer />
        <Routes>
          <Route path="*" element={<DoctorHome />} />
        </Routes>
      </>
    );
  }

  return (
    <>
      <ToastContainer />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="appointments" element={<Appointments />} />
          <Route path="add-doctor" element={<AddDoctor />} />
          <Route path="doctors" element={<DoctorList />} />
          <Route path="doctor/:docId" element={<DoctorProfile />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
