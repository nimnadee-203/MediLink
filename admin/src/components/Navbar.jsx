import React, { useContext } from 'react';
import { AdminContext } from '../context/AdminContext';

const Navbar = () => {
  const { logout, adminEmail } = useContext(AdminContext);

  return (
    <header className="navbar">
      <div className="navbar-logo">
        <h1>MediSync <span>Admin</span></h1>
      </div>

      <div className="navbar-user-profile">
        <div className="avatar">
          {adminEmail ? adminEmail.charAt(0).toUpperCase() : 'A'}
        </div>
        {adminEmail && <span className="user-email">{adminEmail}</span>}
        <button className="logout-btn" onClick={logout}>
          Logout
        </button>
      </div>
    </header>
  );
};

export default Navbar;
