import React from 'react';

const Navbar = () => {
  const handleLogout = () => {
    console.log('Logging out...');
    // Add logout logic here
  };

  return (
    <header className="navbar">
      <button className="logout-btn" onClick={handleLogout}>
        Logout
      </button>
    </header>
  );
};

export default Navbar;
