import React, { useContext } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { useAuth, useClerk } from '@clerk/clerk-react';
import 'react-toastify/dist/ReactToastify.css';

import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Appointments from './pages/Appointments';
import AddDoctor from './pages/AddDoctor';
import DoctorList from './pages/DoctorList';
import DoctorProfile from './pages/DoctorProfile';
import UserManagement from './pages/UserManagement';
import AdminProfile from './pages/AdminProfile';
import DoctorHome from './pages/DoctorHome';
import { AdminContext } from './context/AdminContext';

const AccessDenied = () => {
  const { signOut } = useClerk();

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h2>Access restricted</h2>
          <p><span>Admin / Doctor</span> accounts only</p>
        </div>
        <button className="login-btn" onClick={() => signOut({ redirectUrl: '/signin' })}>
          Sign out
        </button>
      </div>
    </div>
  );
};

const AccessLoading = () => (
  <div className="login-container">
    <div className="login-card">
      <div className="login-header">
        <h2>Checking access</h2>
        <p>Please wait…</p>
      </div>
    </div>
  </div>
);

function App() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isAdminUser, isDoctorUser, profileLoaded } = useContext(AdminContext);

  const authBootstrapping = !isLoaded;
  const canAccessAdmin = isSignedIn && profileLoaded && isAdminUser;
  const canAccessDoctor = isSignedIn && profileLoaded && isDoctorUser;
  const signedInButUnauthorized = isSignedIn && profileLoaded && !isAdminUser && !isDoctorUser;
  const waitingForRoleResolution = isSignedIn && !profileLoaded;

  return (
    <>
      <ToastContainer />
      <Routes>
        <Route
          path="/signin/*"
          element={
            authBootstrapping
              ? <AccessLoading />
              : !isSignedIn
              ? <Login />
              : waitingForRoleResolution
                ? <AccessLoading />
                : canAccessAdmin
                  ? <Navigate to="/users" replace />
                  : canAccessDoctor
                    ? <Navigate to="/doctor-home" replace />
                  : <AccessDenied />
          }
        />

        <Route
          path="/doctor-home"
          element={
            canAccessDoctor
              ? <DoctorHome />
              : canAccessAdmin
                ? <Navigate to="/users" replace />
                : <Navigate to="/signin" replace />
          }
        />

        <Route path="/" element={<Layout />}>
          <Route
            index
            element={canAccessAdmin ? <Dashboard /> : <Navigate to="/signin" replace />}
          />
          <Route
            path="appointments"
            element={canAccessAdmin ? <Appointments /> : <Navigate to="/signin" replace />}
          />
          <Route
            path="add-doctor"
            element={canAccessAdmin ? <AddDoctor /> : <Navigate to="/signin" replace />}
          />
          <Route
            path="doctors"
            element={canAccessAdmin ? <DoctorList /> : <Navigate to="/signin" replace />}
          />
          <Route
            path="doctor/:docId"
            element={canAccessAdmin ? <DoctorProfile /> : <Navigate to="/signin" replace />}
          />
          <Route
            path="users"
            element={canAccessAdmin ? <UserManagement /> : <Navigate to="/signin" replace />}
          />
          <Route
            path="profile"
            element={canAccessAdmin ? <AdminProfile /> : <Navigate to="/signin" replace />}
          />
        </Route>

        <Route
          path="*"
          element={
            authBootstrapping || waitingForRoleResolution
              ? <AccessLoading />
              : canAccessAdmin
                ? <Navigate to="/users" replace />
                : canAccessDoctor
                  ? <Navigate to="/doctor-home" replace />
                : signedInButUnauthorized
                  ? <AccessDenied />
                  : <Navigate to="/signin" replace />
          }
        />
      </Routes>
    </>
  );
}

export default App;
