import React, { useContext, useEffect } from 'react';
import { AdminContext } from '../context/AdminContext';
import { useNavigate } from 'react-router-dom';

const DoctorList = () => {
  const { doctors, getAllDoctors, aToken, changeAvailability } = useContext(AdminContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (aToken) {
      getAllDoctors();
    }
  }, [aToken]);

  return (
    <div className="doctor-list-wrapper">
      <h2 className="page-title">All Doctors</h2>
      
      <div className="doctor-list-container">
        {doctors && doctors.length > 0 ? (
          doctors.map((item, index) => (
            <div 
              key={index} 
              className="doctor-card" 
              onClick={() => navigate(`/doctor/${item._id}`)}
            >
              <div className="doctor-card-img">
                <img src={item.image} alt={item.name} />
              </div>
              <div className="doctor-card-info">
                <p className="doctor-card-name">{item.name}</p>
                <p className="doctor-card-speciality">{item.speciality}</p>
                <div 
                  className="doctor-card-availability"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input 
                    type="checkbox" 
                    checked={item.available} 
                    onChange={() => changeAvailability(item._id)} 
                  />
                  <p>{item.available ? 'Available' : 'Unavailable'}</p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-muted">No doctors registered yet.</p>
        )}
      </div>
    </div>
  );
};

export default DoctorList;
