import React, { useContext } from 'react';
import { AdminContext } from '../context/AdminContext';
import { assets } from '../assets/assets'; // Assuming there's an assets file with icons

const Navbar = () => {
  const { aToken, logout } = useContext(AdminContext);
  const adminEmail = localStorage.getItem('adminEmail') || 'Admin';

  return (
    <header className="navbar">
      <div className="navbar-right">
        <div className="user-profile">
          <div className="user-info">
            <span className="user-label">Logged in as</span>
            <span className="user-email">{adminEmail}</span>
          </div>
          <div className="user-avatar">
            {adminEmail[0].toUpperCase()}
          </div>
        </div>
        <button className="logout-btn" onClick={logout}>
          Logout
        </button>
      </div>
    </header>
  );
};

export default Navbar;
