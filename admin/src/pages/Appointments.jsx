import React, { useContext, useEffect } from 'react';
import { AdminContext } from '../context/AdminContext';
import { assets } from '../assets/assets';

const Appointments = () => {
  const { aToken, appointments, getAllAppointments, cancelAppointment } = useContext(AdminContext);

  useEffect(() => {
    if (aToken) {
      getAllAppointments();
    }
  }, [aToken]);

  return (
    <div className="appointments-page">
      <h2 className="page-title">All Appointments</h2>
      
      <div className="appointments-list-container card">
        <div className="appointments-header-row">
          <p>#</p>
          <p>Patient</p>
          <p>Doctor</p>
          <p>Date & Time</p>
          <p>Fees</p>
          <p>Status</p>
          <p>Action</p>
        </div>

        <div className="appointments-body">
          {appointments.length > 0 ? (
            appointments.map((item, index) => (
              <div className="appointment-item-row" key={index}>
                <p className="item-index">{index + 1}</p>
                <div className="item-patient-info">
                  <p className="item-patient-name">{item.patientName || "Loading..."}</p>
                  <span className="item-patient-id">ID: {item.patientId.slice(-6)}</span>
                </div>
                <p className="item-doctor-name">{item.doctorName || "Loading..."}</p>
                <div className="item-date-time">
                  <p>{item.slotDate}</p>
                  <span>{item.slotTime}</span>
                </div>
                <p className="item-amount">${item.amount}</p>
                <p className={`item-status status-${item.status}`}>
                  {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </p>
                <div className="item-action">
                  {item.status !== "cancelled" ? (
                    <img 
                      src={assets.cancel_icon} 
                      alt="Cancel" 
                      className="cancel-btn-icon" 
                      onClick={() => cancelAppointment(item.id)}
                      title="Cancel Appointment"
                    />
                  ) : (
                    <p className="text-cancelled">Cancelled</p>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="no-data">
              <p>No appointments found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Appointments;
