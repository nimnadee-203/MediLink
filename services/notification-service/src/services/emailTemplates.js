/**
 * Email template for appointment booked for patient
 */
export const appointmentBookedPatient = (data) => {
  const { patientName, doctorName, slotDate, slotTime, visitMode } = data;

  return {
    subject: "Appointment Confirmed - MediLink",
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { padding: 20px; }
    .details { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0; }
    .detail-item { margin: 10px 0; }
    .detail-label { font-weight: bold; color: #667eea; }
    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>✓ Appointment Confirmed</h2>
    </div>
    <div class="content">
      <p>Hi ${patientName},</p>
      <p>Your appointment has been successfully booked!</p>
      
      <div class="details">
        <div class="detail-item">
          <span class="detail-label">Doctor:</span> ${doctorName}
        </div>
        <div class="detail-item">
          <span class="detail-label">Date:</span> ${slotDate}
        </div>
        <div class="detail-item">
          <span class="detail-label">Time:</span> ${slotTime}
        </div>
        <div class="detail-item">
          <span class="detail-label">Visit Mode:</span> ${visitMode === 'telemedicine' ? 'Video Consultation' : 'In-Person'}
        </div>
      </div>

      <p>You will receive a reminder before your appointment. If you need to reschedule or cancel, please do so via your MediLink account at least 24 hours in advance.</p>
      
      <p>Thank you for choosing MediLink!</p>
    </div>
    <div class="footer">
      <p>© 2026 MediLink. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `,
    text: `Your appointment has been confirmed with Dr. ${doctorName} on ${slotDate} at ${slotTime}`
  };
};

/**
 * Email template for appointment booked for doctor
 */
export const appointmentBookedDoctor = (data) => {
  const { patientName, doctorName, slotDate, slotTime, visitMode, reason } = data;

  return {
    subject: "New Appointment Scheduled - MediLink",
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { padding: 20px; }
    .details { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0; }
    .detail-item { margin: 10px 0; }
    .detail-label { font-weight: bold; color: #667eea; }
    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>📅 New Appointment</h2>
    </div>
    <div class="content">
      <p>Dr. ${doctorName},</p>
      <p>A new appointment has been scheduled.</p>
      
      <div class="details">
        <div class="detail-item">
          <span class="detail-label">Patient:</span> ${patientName}
        </div>
        <div class="detail-item">
          <span class="detail-label">Date:</span> ${slotDate}
        </div>
        <div class="detail-item">
          <span class="detail-label">Time:</span> ${slotTime}
        </div>
        <div class="detail-item">
          <span class="detail-label">Visit Mode:</span> ${visitMode === 'telemedicine' ? 'Video Consultation' : 'In-Person'}
        </div>
        ${reason ? `<div class="detail-item">
          <span class="detail-label">Reason:</span> ${reason}
        </div>` : ''}
      </div>

      <p>Please review the appointment details in your MediLink dashboard.</p>
      
      <p>Best regards,<br>MediLink Team</p>
    </div>
    <div class="footer">
      <p>© 2026 MediLink. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `,
    text: `New appointment scheduled with ${patientName} on ${slotDate} at ${slotTime}`
  };
};

/**
 * Email template for appointment cancelled by patient
 */
export const appointmentCancelledByPatient = (data) => {
  const { patientName, doctorName, slotDate, slotTime } = data;

  return {
    subject: "Appointment Cancelled - MediLink",
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
    .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { padding: 20px; }
    .details { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #f5576c; }
    .detail-item { margin: 10px 0; }
    .detail-label { font-weight: bold; color: #f5576c; }
    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>✗ Appointment Cancelled</h2>
    </div>
    <div class="content">
      <p>Dr. ${doctorName},</p>
      <p>A patient has cancelled their appointment.</p>
      
      <div class="details">
        <div class="detail-item">
          <span class="detail-label">Patient:</span> ${patientName}
        </div>
        <div class="detail-item">
          <span class="detail-label">Original Date:</span> ${slotDate}
        </div>
        <div class="detail-item">
          <span class="detail-label">Original Time:</span> ${slotTime}
        </div>
      </div>

      <p>The appointment slot is now available. You can update your availability in your MediLink dashboard if needed.</p>
      
      <p>Best regards,<br>MediLink Team</p>
    </div>
    <div class="footer">
      <p>© 2026 MediLink. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `,
    text: `Patient cancelled appointment scheduled for ${slotDate} at ${slotTime}`
  };
};

/**
 * Email template for appointment cancelled by doctor
 */
export const appointmentCancelledByDoctor = (data) => {
  const { patientName, doctorName, slotDate, slotTime } = data;

  return {
    subject: "Appointment Cancelled - MediLink",
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
    .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { padding: 20px; }
    .details { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #f5576c; }
    .detail-item { margin: 10px 0; }
    .detail-label { font-weight: bold; color: #f5576c; }
    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>✗ Appointment Cancelled</h2>
    </div>
    <div class="content">
      <p>Hi ${patientName},</p>
      <p>Your appointment with Dr. ${doctorName} has been cancelled.</p>
      
      <div class="details">
        <div class="detail-item">
          <span class="detail-label">Doctor:</span> Dr. ${doctorName}
        </div>
        <div class="detail-item">
          <span class="detail-label">Cancelled Date:</span> ${slotDate}
        </div>
        <div class="detail-item">
          <span class="detail-label">Cancelled Time:</span> ${slotTime}
        </div>
      </div>

      <p>Please book a new appointment if you still need medical consultation. You can schedule another appointment through your MediLink account.</p>
      
      <p>We apologize for any inconvenience.</p>
      
      <p>Best regards,<br>MediLink Team</p>
    </div>
    <div class="footer">
      <p>© 2026 MediLink. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `,
    text: `Your appointment with Dr. ${doctorName} scheduled for ${slotDate} at ${slotTime} has been cancelled.`
  };
};

export default {
  appointmentBookedPatient,
  appointmentBookedDoctor,
  appointmentCancelledByPatient,
  appointmentCancelledByDoctor
};
