import { sendEmail } from "./emailService.js";
import * as emailTemplates from "./emailTemplates.js";

/**
 * Get user email address from their ID (fetch from user service)
 * This is a placeholder - in production, this should call the actual user service
 */
async function getUserEmail(userId, userType) {
  try {
    if (userType === "patient") {
      const response = await fetch(`http://localhost:8002/api/patients/emails/${userId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });
      if (response.ok) {
        const data = await response.json();
        return data.email;
      }
    } else if (userType === "doctor") {
      const response = await fetch(`http://localhost:4000/api/doctor/emails/${userId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });
      if (response.ok) {
        const data = await response.json();
        return data.email;
      }
    }
  } catch (error) {
    console.error(`[EMAIL-UTIL] Failed to fetch email for ${userType} ${userId}:`, error.message);
  }
  return null;
}

/**
 * Get user name from their ID
 * This is a placeholder - in production, this should call the actual user service
 */
async function getUserName(userId, userType) {
  try {
    if (userType === "patient") {
      const response = await fetch(`http://localhost:8002/api/patients/${userId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });
      if (response.ok) {
        const data = await response.json();
        return data.name;
      }
    } else if (userType === "doctor") {
      const response = await fetch(`http://localhost:4000/api/doctor/${userId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });
      if (response.ok) {
        const data = await response.json();
        // The doctor service returns { success: true, doctor: { ... } }
        return data.doctor?.name || "Doctor";
      }
    }
  } catch (error) {
    console.error(`[EMAIL-UTIL] Failed to fetch name for ${userType} ${userId}:`, error.message);
  }
  return "User";
}

/**
 * Send email based on notification type
 */
export async function sendNotificationEmail(notification, appointmentDetails) {
  const { recipientId, recipientRole, type, title } = notification;

  // Get recipient email
  const email = await getUserEmail(recipientId, recipientRole);
  if (!email) {
    console.log(`[EMAIL-SKIP] No email found for ${recipientRole} ${recipientId}`);
    return;
  }

  let emailTemplate = null;

  if (type === "appointment_booked" && recipientRole === "patient") {
    const patientName = await getUserName(recipientId, "patient");
    const doctorName = await getUserName(appointmentDetails.doctorId, "doctor");
    emailTemplate = emailTemplates.appointmentBookedPatient({
      patientName,
      doctorName,
      slotDate: appointmentDetails.slotDate,
      slotTime: appointmentDetails.slotTime,
      visitMode: appointmentDetails.visitMode
    });
  } else if (type === "appointment_booked" && recipientRole === "doctor") {
    const patientName = await getUserName(appointmentDetails.patientId, "patient");
    const doctorName = await getUserName(recipientId, "doctor");
    emailTemplate = emailTemplates.appointmentBookedDoctor({
      patientName,
      doctorName,
      slotDate: appointmentDetails.slotDate,
      slotTime: appointmentDetails.slotTime,
      visitMode: appointmentDetails.visitMode,
      reason: appointmentDetails.reason
    });
  } else if (type === "appointment_cancelled_by_patient") {
    const patientName = await getUserName(appointmentDetails.patientId, "patient");
    const doctorName = await getUserName(recipientId, "doctor");
    emailTemplate = emailTemplates.appointmentCancelledByPatient({
      patientName,
      doctorName,
      slotDate: appointmentDetails.slotDate,
      slotTime: appointmentDetails.slotTime
    });
  } else if (type === "appointment_cancelled_by_doctor") {
    const patientName = await getUserName(recipientId, "patient");
    const doctorName = await getUserName(appointmentDetails.doctorId, "doctor");
    emailTemplate = emailTemplates.appointmentCancelledByDoctor({
      patientName,
      doctorName,
      slotDate: appointmentDetails.slotDate,
      slotTime: appointmentDetails.slotTime
    });
  }

  if (!emailTemplate) {
    console.log(`[EMAIL-SKIP] No template for notification type: ${type}`);
    return;
  }

  try {
    await sendEmail({
      to: email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text
    });
  } catch (error) {
    console.error(`[EMAIL-ERROR] Failed to send email for ${type}:`, error.message);
  }
}

export default { sendNotificationEmail, getUserEmail, getUserName };
