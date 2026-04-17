import { sendEmail, getConfirmationTemplate, getCancellationTemplate } from '../services/email.service.js';

export const sendNotification = async (req, res) => {
  const { type, recipientEmail, details } = req.body;

  if (!type || !recipientEmail || !details) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    let subject = '';
    let html = '';

    if (type === 'appointment_booked') {
      subject = 'Appointment Confirmation - MediSync';
      html = getConfirmationTemplate(details);
    } else if (type === 'appointment_cancelled') {
        subject = 'Appointment Cancellation - MediSync';
        html = getCancellationTemplate(details);
    } else {
        return res.status(400).json({ success: false, message: 'Invalid notification type' });
    }

    await sendEmail({ to: recipientEmail, subject, html });

    return res.json({ success: true, message: 'Notification sent successfully' });
  } catch (error) {
    console.error('Notification error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send notification', error: error.message });
  }
};
