import React from 'react';

export const Dashboard = () => (
  <div>
    <h2>Dashboard</h2>
    <div className="card">
      <p>Welcome to the Admin Dashboard. Summary of statistics will appear here.</p>
    </div>
  </div>
);

export const Appointments = () => (
  <div>
    <h2>Appointments</h2>
    <div className="card">
      <p>Management of patient appointments will be handled in this view.</p>
    </div>
  </div>
);

export const AddDoctor = () => (
  <div>
    <h2>Add Doctor</h2>
    <div className="card">
      <p>Form to add a new doctor to the system will be implemented here.</p>
    </div>
  </div>
);

export const DoctorList = () => (
  <div>
    <h2>Doctor List</h2>
    <div className="card">
      <p>Table listing all registered doctors will be displayed here.</p>
    </div>
  </div>
);
