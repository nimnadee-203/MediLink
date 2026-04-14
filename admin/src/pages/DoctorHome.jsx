import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminContext } from '../context/AdminContext';

const DoctorHome = () => {
  const navigate = useNavigate();
  const { setDToken } = useContext(AdminContext);

  const onLogout = () => {
    localStorage.removeItem('dToken');
    setDToken('');
    navigate('/');
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h2>Doctor Login Successful</h2>
          <p>
            You are signed in. Doctor dashboard pages are not implemented in this admin app yet.
          </p>
        </div>

        <button type="button" className="login-btn" onClick={onLogout}>
          Logout
        </button>
      </div>
    </div>
  );
};

export default DoctorHome;
