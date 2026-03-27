import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { Dashboard, Appointments, AddDoctor, DoctorList } from './pages/AdminPages';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="appointments" element={<Appointments />} />
        <Route path="add-doctor" element={<AddDoctor />} />
        <Route path="doctors" element={<DoctorList />} />
      </Route>
    </Routes>
  );
}

export default App;
