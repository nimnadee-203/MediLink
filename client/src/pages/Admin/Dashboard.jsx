import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Stethoscope, ClipboardList, TrendingUp } from 'lucide-react';
import { Card } from '../../components/ui';

const Dashboard = () => (
  <div className="space-y-6">
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        { label: 'Active patients', value: '—', icon: Users, tone: 'text-blue-600 bg-blue-50' },
        { label: 'Clinicians on directory', value: '—', icon: Stethoscope, tone: 'text-indigo-600 bg-indigo-50' },
        { label: 'Appointments today', value: '—', icon: ClipboardList, tone: 'text-violet-600 bg-violet-50' },
        { label: 'Utilization', value: '—', icon: TrendingUp, tone: 'text-emerald-600 bg-emerald-50' }
      ].map(({ label, value, icon: Icon, tone }) => (
        <Card key={label} className="p-5 border-slate-200 rounded-2xl shadow-md">
          <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
            <Icon size={20} />
          </div>
          <p className="mt-4 text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mt-1">{label}</p>
        </Card>
      ))}
    </div>
    <Card className="p-8 border-slate-200 rounded-2xl shadow-md">
      <h2 className="text-lg font-bold text-slate-900">Operations overview</h2>
      <p className="mt-3 text-slate-600 text-sm leading-relaxed">
        Connect microservices for live metrics: registrations, channeling volume, and SLA dashboards. Extend this panel
        with your operational data sources and visualization stack.
      </p>
      <ul className="mt-6 space-y-2 text-sm text-slate-600 list-disc list-inside">
        <li>
          Integrate <code className="text-blue-700 bg-blue-50 px-1 rounded">/api/admin/dashboard</code> and related admin
          APIs.
        </li>
        <li>Enforce role-based access so only authorized staff can open the operations console.</li>
      </ul>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to="/"
          className="text-sm font-semibold text-blue-700 hover:text-blue-800"
        >
          ← Back to platform home
        </Link>
      </div>
    </Card>
  </div>
);

export default Dashboard;
