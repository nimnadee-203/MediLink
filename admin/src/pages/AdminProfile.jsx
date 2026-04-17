import React, { useContext } from 'react';
import { AdminContext } from '../context/AdminContext';

const AdminProfile = () => {
  const { profileForm, setProfileForm, saveProfile, loading, clerkEmail } = useContext(AdminContext);

  const onSubmit = async (event) => {
    event.preventDefault();
    await saveProfile();
  };

  return (
    <div className="admin-profile-page">
      <h2 className="page-title">Admin Profile</h2>

      <div className="card users-form-card">
        <h3>Profile Details</h3>

        <form onSubmit={onSubmit} className="doctor-form-grid">
          <div className="form-item">
            <p>Verified Email</p>
            <input value={clerkEmail || ''} readOnly disabled />
          </div>

          <div className="form-item">
            <p>Full Name</p>
            <input
              value={profileForm.name}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div className="form-item">
            <p>Phone</p>
            <input
              value={profileForm.phone}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
            />
          </div>

          <div className="form-item">
            <p>Age</p>
            <input
              type="number"
              min="0"
              value={profileForm.age}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, age: e.target.value }))}
            />
          </div>

          <div className="form-item">
            <p>Gender</p>
            <select
              value={profileForm.gender}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, gender: e.target.value }))}
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-item form-item-full">
            <p>Address</p>
            <input
              value={profileForm.address}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, address: e.target.value }))}
            />
          </div>

          <button className="add-doctor-btn" type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminProfile;
