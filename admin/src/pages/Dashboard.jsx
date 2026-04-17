import React, { useContext, useEffect } from 'react';
import { AdminContext } from '../context/AdminContext';
import { assets } from '../assets/assets';
import { Users, Stethoscope, ClipboardList, TrendingUp, Calendar, X, ArrowRight } from 'lucide-react';

const Dashboard = () => {
  const { getDashData, dashData, cancelAppointment, adminEmail, isAdminUser, profileLoaded } = useContext(AdminContext);

  useEffect(() => {
    if (profileLoaded && isAdminUser) {
      getDashData();
    }
  }, [profileLoaded, isAdminUser, getDashData]);

  const stats = [
    { label: 'Total Patients', value: dashData ? dashData.patients : '0', icon: Users, color: '#4f46e5', bg: 'rgba(79, 70, 229, 0.1)' },
    { label: 'Active Doctors', value: dashData ? dashData.doctors : '0', icon: Stethoscope, color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)' },
    { label: 'Total Bookings', value: dashData ? dashData.appoiments : '0', icon: ClipboardList, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
    { label: 'Success Rate', value: '94%', icon: TrendingUp, color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' }
  ];

  return (
    <div className="dashboard-wrapper animate-fade-in">
      {/* Welcome Banner */}
      <div className="welcome-banner">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold mb-2">Welcome Back, {adminEmail.split('@')[0]}!</h1>
          <p className="text-indigo-100 max-w-lg">
            Monitor facility performance, manage clinicians, and review channeling metrics in real-time.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stat-grid">
        {stats.map(({ label, value, icon: Icon, color, bg }, idx) => (
          <div key={label} className="glass-stat-card animate-slide-in" style={{ animationDelay: `${idx * 0.1}s` }}>
            <div className="stat-icon-box" style={{ color: color, backgroundColor: bg }}>
              <Icon size={28} />
            </div>
            <div className="stat-info">
              <p className="stat-value">{value}</p>
              <p className="stat-label">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="activity-card mt-10 overflow-hidden">
        <div className="activity-header">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-xl">
              <Calendar size={20} />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Recent Channeling Activity</h3>
          </div>
          <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 group">
            View All <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="activity-body divide-y divide-slate-100">
          {dashData && dashData.latestAppoiments && dashData.latestAppoiments.length > 0 ? (
            dashData.latestAppoiments.map((item, index) => (
              <div key={index} className="activity-item group">
                <div className="p-avatar">
                  {item.patientId ? "P" : "?"}
                </div>
                <div className="p-details">
                  <p className="text-sm font-bold text-slate-900">Patient ID: {item.patientId ? item.patientId.slice(-6) : "N/A"}</p>
                  <p className="text-xs text-slate-500 font-medium">{item.slotTime} • {item.slotDate}</p>
                </div>
                <div>
                  <span className={`status-pill ${item.cancelled ? 'pill-cancelled' : 'pill-active'}`}>
                    {item.cancelled ? 'Cancelled' : 'Scheduled'}
                  </span>
                </div>
                <div className="flex justify-end">
                  {!item.cancelled && (
                    <div 
                      onClick={() => cancelAppointment(item._id)}
                      className="action-btn-circle text-rose-500"
                      title="Cancel Channeling"
                    >
                      <X size={18} />
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center text-slate-400">
              <p className="font-medium text-lg">No recent activity found.</p>
              <p className="text-sm mt-1">Live updates will appear here once new bookings are made.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
