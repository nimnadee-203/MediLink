import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: 'smtp-brevo.com',
  port: 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendEmail = async ({ to, subject, html }) => {
  try {
    const info = await transporter.sendMail({
      from: `"MediSync Notifications" <${process.env.SENDER_EMAIL}>`,
      to,
      subject,
      html,
    });
    console.log('Message sent: %s', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

export const getConfirmationTemplate = (details) => `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <h2 style="color: #2c3e50;">Appointment Confirmation</h2>
  <p>Dear <strong>${details.patientName}</strong>,</p>
  <p>Your appointment has been successfully booked with <strong>Dr. ${details.doctorName}</strong>.</p>
  <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; border: 1px solid #eee;">
    <p><strong>Date:</strong> ${details.slotDate}</p>
    <p><strong>Time:</strong> ${details.slotTime}</p>
    <p><strong>Reason:</strong> ${details.reason || 'N/A'}</p>
  </div>
  <p>Thank you for choosing MediSync!</p>
</div>
`;

export const getCancellationTemplate = (details) => `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <h2 style="color: #e74c3c;">Appointment Cancelled</h2>
  <p>Dear <strong>${details.patientName}</strong>,</p>
  <p>We regret to inform you that your appointment with <strong>Dr. ${details.doctorName}</strong> on <strong>${details.slotDate}</strong> at <strong>${details.slotTime}</strong> has been cancelled.</p>
  <p><strong>Reason:</strong> ${details.cancellationReason || 'Cancelled by provider'}</p>
  <p>Please log in to MediSync to reschedule your appointment.</p>
</div>
`;
