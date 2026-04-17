import React, { useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Bell } from 'lucide-react';
import { AdminContext } from '../context/AdminContext';

function formatTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function DoctorNotificationBell() {
  const { backendUrl, getDoctorAuthHeaders, isDoctorUser } = useContext(AdminContext);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const wrapRef = useRef(null);

  const load = async () => {
    if (!isDoctorUser) return;
    try {
      const headers = await getDoctorAuthHeaders();
      const { data } = await axios.get(`${backendUrl}/api/doctor/notifications`, {
        headers
      });
      setItems(Array.isArray(data.notifications) ? data.notifications : []);
      setUnread(Number(data.unreadCount) || 0);
    } catch (err) {
      console.warn('[DoctorNotificationBell] load failed', err?.response?.status, err?.message || err);
      setItems([]);
      setUnread(0);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 45000);
    return () => clearInterval(id);
  }, [isDoctorUser, backendUrl, getDoctorAuthHeaders]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const onMarkRead = async (id) => {
    if (!isDoctorUser) return;
    try {
      const headers = await getDoctorAuthHeaders();
      await axios.patch(
        `${backendUrl}/api/doctor/notifications/${encodeURIComponent(id)}/read`,
        {},
        { headers }
      );
      await load();
    } catch {
      /* ignore */
    }
  };

  if (!isDoctorUser) return null;

  return (
    <div className="notification-bell-wrap" ref={wrapRef}>
      <button
        type="button"
        className="notification-bell-btn"
        onClick={() => {
          setOpen((o) => !o);
          load();
        }}
        aria-expanded={open}
        aria-label="Notifications"
      >
        <Bell size={20} strokeWidth={2} />
        {unread > 0 && (
          <span className="notification-bell-badge">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-head">
            <span>Notifications</span>
            {items.length > 0 && (
              <button
                type="button"
                className="notification-mark-all"
                onClick={() => {
                  items.filter((n) => !n.read).forEach((n) => onMarkRead(n.id));
                }}
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="notification-dropdown-body">
            {items.length === 0 ? (
              <p className="notification-dropdown-empty">No notifications yet.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`notification-item ${n.read ? '' : 'unread'}`}
                  onClick={() => {
                    if (!n.read) onMarkRead(n.id);
                  }}
                >
                  <p className="notification-item-title">{n.title}</p>
                  {n.body ? <p className="notification-item-body">{n.body}</p> : null}
                  <p className="notification-item-time">{formatTime(n.createdAt)}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
