import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Bell } from 'lucide-react';
import { patientRequest } from '../lib/patientRequest';
import { cn } from './ui';

function formatTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function NotificationBell() {
  const { getToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const wrapRef = useRef(null);

  const load = async () => {
    try {
      const data = await patientRequest('/notifications', getToken);
      setItems(Array.isArray(data.notifications) ? data.notifications : []);
      setUnread(Number(data.unreadCount) || 0);
    } catch (err) {
      console.warn('[NotificationBell] load failed', err?.message || err);
      setItems([]);
      setUnread(0);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 45000);
    return () => clearInterval(id);
  }, [getToken]);

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
    try {
      await patientRequest(`/notifications/${encodeURIComponent(id)}/read`, getToken, {
        method: 'PATCH',
        body: {}
      });
      await load();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          load();
        }}
        className={cn(
          'relative flex items-center justify-center p-2 md:p-2.5 rounded-xl text-sm font-bold transition-all',
          open ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
        )}
        aria-expanded={open}
        aria-label="Notifications"
      >
        <Bell size={18} strokeWidth={2.25} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 flex items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(100vw-2rem,22rem)] rounded-2xl border border-slate-200/80 bg-white shadow-xl shadow-slate-900/10 z-[60] overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-800">Notifications</span>
            {items.length > 0 && (
              <button
                type="button"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                onClick={() => {
                  items.filter((n) => !n.read).forEach((n) => onMarkRead(n.id));
                }}
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">No notifications yet.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    if (!n.read) onMarkRead(n.id);
                  }}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors',
                    !n.read && 'bg-indigo-50/40'
                  )}
                >
                  <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                  {n.body ? <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.body}</p> : null}
                  <p className="text-[11px] text-slate-400 mt-1.5">{formatTime(n.createdAt)}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
