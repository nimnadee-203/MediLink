import React, { useContext } from 'react';
import { useUser } from '@clerk/clerk-react';
import { AdminContext } from '../context/AdminContext';

const Navbar = () => {
  const { logout } = useContext(AdminContext);
  const { user } = useUser();

  const userEmail = user?.primaryEmailAddress?.emailAddress || '';
  const userName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
    'Admin';

  return (
    <header className="navbar">
      <div className="navbar-logo">
        <h1>MediSync <span>Admin</span></h1>
      </div>

      <div className="navbar-user-profile">
        <div className="avatar">
          {userName.charAt(0).toUpperCase()}
        </div>
        {userEmail && <span className="user-email">{userEmail}</span>}
        <button className="logout-btn" onClick={logout}>
          Logout
        </button>
      </div>
    </header>
  );
};

export default Navbar;
