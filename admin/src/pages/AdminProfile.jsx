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
      <div className="card profile-hero">
        <div>
          <h2 className="page-title">Admin Profile</h2>
          <p>Manage your verified account details and personal information.</p>
        </div>
      </div>

      <div className="card users-form-card profile-premium-card">
        <div className="profile-card-head">
          <h3>Profile Details</h3>
          <p>Your email is verified through Clerk and cannot be edited here.</p>
        </div>

        <form onSubmit={onSubmit} className="doctor-form-grid profile-form-grid">
          <div className="form-item form-item-full profile-field profile-verified">
            <p>Verified Email</p>
            <input value={clerkEmail || ''} readOnly disabled />
          </div>

          <div className="form-item profile-field">
            <p>Full Name</p>
            <input
              value={profileForm.name}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Enter your full name"
              required
            />
          </div>

          <div className="form-item profile-field">
            <p>Phone</p>
            <input
              value={profileForm.phone}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="Enter phone number"
            />
          </div>

          <div className="form-item profile-field">
            <p>Age</p>
            <input
              type="number"
              min="0"
              value={profileForm.age}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, age: e.target.value }))}
              placeholder="Enter age"
            />
          </div>

          <div className="form-item profile-field">
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

          <div className="form-item form-item-full profile-field">
            <p>Address</p>
            <input
              value={profileForm.address}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, address: e.target.value }))}
              placeholder="Enter address"
            />
          </div>

          <div className="users-edit-actions profile-actions">
            <button className="users-btn users-btn-primary profile-save-btn" type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminProfile;
