import React from 'react';
import { NavLink } from 'react-router-dom';

const Sidebar = () => {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        MediSync AI
      </div>
      <nav className="sidebar-menu">
        <NavLink 
          to="/" 
          className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}
          end
        >
          Dashboard
        </NavLink>
        <NavLink 
          to="/appointments" 
          className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}
        >
          Appointments
        </NavLink>
        <NavLink 
          to="/add-doctor" 
          className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}
        >
          Add Doctor
        </NavLink>
        <NavLink 
          to="/doctors" 
          className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}
        >
          Doctor List
        </NavLink>
      </nav>
    </div>
  );
};

export default Sidebar;
