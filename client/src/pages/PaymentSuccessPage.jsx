import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Download, Home, BadgeCheck } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Button } from '../components/ui';

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  if (Number.isNaN(amount)) return 'Rs 0.00';
  return `Rs ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDateLabel = (value) => {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export default function PaymentSuccessPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const state = location.state || {};
  const bookingRef = state.paymentId || `PAY-${Date.now()}`;
  const totalPaid = formatCurrency(state.amount);
  const appointmentDate = formatDateLabel(state.appointmentDate);
  const generatedAt = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  const receiptData = useMemo(
    () => ({
      bookingRef,
      totalPaid,
      patientId: state.patientId || 'N/A',
      doctorId: state.doctorId || 'N/A',
      appointmentDate,
      generatedAt
    }),
    [bookingRef, totalPaid, state.patientId, state.doctorId, appointmentDate, generatedAt]
  );

  const downloadReceipt = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    doc.setFillColor(17, 76, 146);
    doc.rect(0, 0, 210, 34, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('MediSync Multi-Speciality Hospital', 14, 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Official Invoice | Hotline: +94 11 234 5678 | support@medisync.ai', 14, 21);

    doc.setFontSize(9);
    doc.text('Address: Colombo, Sri Lanka', 14, 27);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('PAYMENT INVOICE', 14, 44);

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(14, 47, 196, 47);

    const leftX = 14;
    const rightX = 116;
    const rowHeight = 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    doc.text(`Invoice No: ${receiptData.bookingRef}`, leftX, 56);
    doc.text(`Patient ID: ${receiptData.patientId}`, leftX, 56 + rowHeight);
    doc.text(`Doctor ID: ${receiptData.doctorId}`, leftX, 56 + rowHeight * 2);

    doc.text(`Status: Paid / Confirmed`, rightX, 56);
    doc.text(`Appointment Date: ${receiptData.appointmentDate}`, rightX, 56 + rowHeight);
    doc.text(`Issued On: ${receiptData.generatedAt}`, rightX, 56 + rowHeight * 2);

    const tableTop = 84;
    doc.setFillColor(239, 246, 255);
    doc.rect(14, tableTop, 182, 10, 'F');
    doc.setDrawColor(191, 219, 254);
    doc.rect(14, tableTop, 182, 44);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.setFontSize(10);
    doc.text('Description', 18, tableTop + 6.5);
    doc.text('Department', 98, tableTop + 6.5);
    doc.text('Qty', 148, tableTop + 6.5);
    doc.text('Amount', 170, tableTop + 6.5);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.line(14, tableTop + 10, 196, tableTop + 10);
    doc.text('Consultation - Outpatient Appointment', 18, tableTop + 19);
    doc.text('General OPD', 98, tableTop + 19);
    doc.text('1', 149, tableTop + 19);
    doc.text(receiptData.totalPaid, 170, tableTop + 19);

    doc.line(14, tableTop + 24, 196, tableTop + 24);

    const totalsY = tableTop + 33;
    doc.setFontSize(10);
    doc.text('Sub Total', 138, totalsY);
    doc.text(receiptData.totalPaid, 170, totalsY);
    doc.text('Service Charge', 138, totalsY + 6);
    doc.text('Rs 0.00', 170, totalsY + 6);
    doc.text('Tax', 138, totalsY + 12);
    doc.text('Rs 0.00', 170, totalsY + 12);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 76, 146);
    doc.text('Total Paid', 138, totalsY + 20);
    doc.text(receiptData.totalPaid, 170, totalsY + 20);

    doc.setDrawColor(191, 219, 254);
    doc.roundedRect(14, 138, 182, 12, 2, 2);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 58, 138);
    doc.setFontSize(9.6);
    doc.text('Payment received successfully via Stripe. Keep this invoice for reimbursement and records.', 17, 145.6);

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.text('This is a system-generated hospital invoice and does not require a physical signature.', 14, 160);

    doc.save(`hospital-invoice-${receiptData.bookingRef}.pdf`);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="rounded-[28px] border border-blue-100/80 bg-gradient-to-br from-white via-blue-50/40 to-sky-50/50 p-6 sm:p-10 shadow-xl shadow-slate-900/5">
        <div className="mx-auto w-fit rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-blue-700 text-sm font-semibold inline-flex items-center gap-2">
          <BadgeCheck size={16} />
          Payment completed
        </div>

        <div className="mt-6 flex justify-center">
          <div className="h-16 w-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/30">
            <CheckCircle2 size={34} />
          </div>
        </div>

        <h1 className="mt-6 text-center text-3xl font-black tracking-tight text-slate-900">Booking confirmed.</h1>
        <p className="mt-3 text-center text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Your payment was successful and your appointment is now secured in MediSync.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
            <p className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">Booking Ref</p>
            <p className="mt-2 text-slate-800 font-bold break-all">{bookingRef}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
            <p className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">Status</p>
            <p className="mt-2 text-slate-800 font-bold">Paid / Confirmed</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
            <p className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">Total Paid</p>
            <p className="mt-2 text-slate-900 font-black text-xl">{totalPaid}</p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-blue-800 text-sm">
          Download your hospital-style invoice now, or return home to continue using MediSync.
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-stretch justify-center gap-3">
          <Button className="rounded-xl min-w-[220px]" onClick={downloadReceipt}>
            <Download size={18} /> Download Receipt / Invoice
          </Button>
          <Button variant="secondary" className="rounded-xl min-w-[180px]" onClick={() => navigate('/dashboard')}>
            <Home size={18} /> Return to Home
          </Button>
        </div>

        <p className="mt-7 text-center text-xs text-slate-500">Thank you for choosing MediSync for your care.</p>
      </div>
    </div>
  );
}
