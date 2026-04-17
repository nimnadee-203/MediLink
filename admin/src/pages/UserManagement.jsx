import React, { useContext, useState } from 'react';
import { Users, Settings, AlertCircle } from 'lucide-react';
import { AdminContext } from '../context/AdminContext';

const initialNewUser = {
  name: '',
  username: '',
  email: '',
  password: '',
  role: 'patient',
  phone: ''
};

const initialEdit = {
  id: '',
  name: '',
  email: '',
  role: 'patient',
  phone: ''
};

const UserManagement = () => {
  const { adminUsers, loading, createAdminUser, updateUserRole, updateAdminUser, deleteAdminUser } = useContext(AdminContext);

  const [newUser, setNewUser] = useState(initialNewUser);
  const [editingUser, setEditingUser] = useState(initialEdit);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const onCreate = async (event) => {
    event.preventDefault();
    const ok = await createAdminUser(newUser);
    if (ok) {
      setNewUser(initialNewUser);
      setIsCreateModalOpen(false);
    }
  };

  const onStartEdit = (user) => {
    if (user.source === 'doctor-db') {
      return;
    }

    setEditingUser({
      id: user.id,
      name: user.name || '',
      email: user.email || '',
      role: user.role || 'patient',
      phone: user.phone || ''
    });
  };

  const onCancelEdit = () => {
    setEditingUser(initialEdit);
  };

  const onSaveEdit = async (event) => {
    event.preventDefault();
    if (!editingUser.id) return;

    const ok = await updateAdminUser(editingUser.id, {
      name: editingUser.name,
      email: editingUser.email,
      role: editingUser.role,
      phone: editingUser.phone
    });

    if (ok) {
      setEditingUser(initialEdit);
    }
  };

  const onDelete = async (id) => {
    const confirmed = window.confirm('Delete this user? This action cannot be undone.');
    if (!confirmed) return;

    const ok = await deleteAdminUser(id);
    if (ok && editingUser.id === id) {
      setEditingUser(initialEdit);
    }
  };

  return (
    <div className="user-management-page">
      <div className="users-page-head card">
        <div>
          <h2 className="page-title">User Management</h2>
          <p>Manage system access, update details, and assign roles.</p>
        </div>
        <button
          type="button"
          className="add-doctor-btn users-create-btn"
          onClick={() => setIsCreateModalOpen(true)}
          disabled={loading}
        >
          Create User
        </button>
      </div>

      <div className="card users-section-card">
        <div className="users-section-header">
          <h3>Active Users</h3>
          <p>Click the gear icon to open the edit form in a popup.</p>
        </div>

        <div className="users-list">
          {adminUsers.map((adminUser) => (
            <div key={adminUser.uid || adminUser.id} className="user-row">
              <div className="user-main">
                <div className="user-avatar">{(adminUser.name || 'U').charAt(0).toUpperCase()}</div>
                <div>
                  <p className="user-name">{adminUser.name || 'Unnamed user'}</p>
                  <p className="user-email">
                    {adminUser.email?.endsWith('@clerk.local') ? 'Syncing email…' : adminUser.email}
                    {adminUser.role ? ` • ${adminUser.role.charAt(0).toUpperCase()}${adminUser.role.slice(1)}` : ''}
                  </p>
                </div>
              </div>

              <div className="user-actions">
                <select
                  value={adminUser.role || 'patient'}
                  onChange={(e) => updateUserRole(adminUser.id, e.target.value)}
                  disabled={loading || adminUser.source === 'doctor-db'}
                >
                  <option value="patient">Patient</option>
                  <option value="doctor">Doctor</option>
                  <option value="admin">Admin</option>
                </select>

                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => onStartEdit(adminUser)}
                  title="Edit user"
                  disabled={loading || adminUser.source === 'doctor-db'}
                >
                  <Settings size={17} />
                </button>

                <button
                  type="button"
                  className="icon-btn danger"
                  onClick={() => onDelete(adminUser.id)}
                  title="Delete user"
                  disabled={loading || adminUser.source === 'doctor-db'}
                >
                  <AlertCircle size={17} />
                </button>
              </div>
            </div>
          ))}

          {adminUsers.length === 0 && (
            <div className="no-data users-no-data">
              <Users size={40} />
              <p>No users found.</p>
            </div>
          )}
        </div>
      </div>

      {isCreateModalOpen && (
        <div className="users-modal-overlay" onClick={() => !loading && setIsCreateModalOpen(false)}>
          <div className="users-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="users-modal-head">
              <h3>Create New User</h3>
              <button
                type="button"
                className="users-modal-close"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={loading}
              >
                ×
              </button>
            </div>
            <form onSubmit={onCreate} className="doctor-form-grid">
              <div className="form-item">
                <p>Full Name</p>
                <input
                  value={newUser.name}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div className="form-item">
                <p>Username</p>
                <input
                  value={newUser.username}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, username: e.target.value }))}
                  required
                />
              </div>

              <div className="form-item">
                <p>Email</p>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>

              <div className="form-item">
                <p>Phone</p>
                <input
                  value={newUser.phone}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </div>

              <div className="form-item">
                <p>Temporary Password</p>
                <input
                  type="password"
                  minLength={8}
                  value={newUser.password}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
                  required
                />
              </div>

              <div className="form-item">
                <p>Role</p>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, role: e.target.value }))}
                >
                  <option value="patient">Patient</option>
                  <option value="doctor">Doctor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="users-edit-actions">
                <button type="button" className="users-btn users-btn-secondary" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </button>
                <button className="users-btn users-btn-primary" type="submit" disabled={loading}>
                  {loading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingUser.id && (
        <div className="users-modal-overlay" onClick={onCancelEdit}>
          <div className="users-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="users-modal-head">
              <h3>Edit User</h3>
              <button type="button" className="users-modal-close" onClick={onCancelEdit}>×</button>
            </div>
            <form onSubmit={onSaveEdit} className="doctor-form-grid">
              <div className="form-item">
                <p>Full Name</p>
                <input
                  value={editingUser.name}
                  onChange={(e) => setEditingUser((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div className="form-item">
                <p>Email</p>
                <input
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser((prev) => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>

              <div className="form-item">
                <p>Phone</p>
                <input
                  value={editingUser.phone}
                  onChange={(e) => setEditingUser((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </div>

              <div className="form-item">
                <p>Role</p>
                <select
                  value={editingUser.role}
                  onChange={(e) => setEditingUser((prev) => ({ ...prev, role: e.target.value }))}
                >
                  <option value="patient">Patient</option>
                  <option value="doctor">Doctor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="users-edit-actions">
                <button type="button" className="users-btn users-btn-secondary" onClick={onCancelEdit}>
                  Cancel
                </button>
                <button type="submit" className="users-btn users-btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
