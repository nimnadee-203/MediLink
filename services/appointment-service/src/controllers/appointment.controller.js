import mongoose from "mongoose";
import Appointment from "../models/Appointment.js";
import axios from "axios";
import { sendNotificationToUser } from "../lib/notificationClient.js";

const editableStatuses = new Set(["pending", "confirmed"]);
const validStatuses = new Set(["pending", "confirmed", "cancelled", "completed"]);
const validPaymentStatuses = new Set(["pending", "paid", "failed", "refunded"]);
const validVisitModes = new Set(["in_person", "telemedicine"]);

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const sanitizeAppointment = (appointment) => ({
  id: appointment._id,
  patientId: appointment.patientId,
  doctorId: appointment.doctorId,
  slotDate: appointment.slotDate,
  slotTime: appointment.slotTime,
  amount: appointment.amount,
  reason: appointment.reason,
  notes: appointment.notes,
  visitMode: appointment.visitMode,
  reportIds: (appointment.reportIds || []).map((id) => String(id)),
  status: appointment.status,
  paymentStatus: appointment.paymentStatus,
  cancelledAt: appointment.cancelledAt,
  cancelledBy: appointment.cancelledBy,
  createdAt: appointment.createdAt,
  updatedAt: appointment.updatedAt
});

const parseBookingPayload = (body) => {
  const {
    patientId,
    doctorId,
    slotDate,
    slotTime,
    amount,
    reason,
    notes,
    visitMode,
    reportIds,
    status,
    paymentStatus
  } = body;

  return {
    patientId,
    doctorId,
    slotDate,
    slotTime,
    amount,
    reason,
    notes,
    visitMode,
    reportIds,
    status,
    paymentStatus
  };
};

const ensureBookingPayload = (payload) => {
  const requiredFields = ["patientId", "doctorId", "slotDate", "slotTime", "amount"];
  const missingFields = requiredFields.filter((field) => payload[field] === undefined || payload[field] === null || payload[field] === "");

  if (missingFields.length > 0) {
    return `Missing required fields: ${missingFields.join(", ")}`;
  }

  if (!isValidObjectId(payload.patientId)) {
    return "patientId must be a valid MongoDB ObjectId";
  }

  if (!isValidObjectId(payload.doctorId)) {
    return "doctorId must be a valid MongoDB ObjectId";
  }

  if (typeof payload.amount !== "number" || Number.isNaN(payload.amount) || payload.amount < 0) {
    return "amount must be a valid non-negative number";
  }

  if (payload.status && !validStatuses.has(payload.status)) {
    return "status is invalid";
  }

  if (payload.paymentStatus && !validPaymentStatuses.has(payload.paymentStatus)) {
    return "paymentStatus is invalid";
  }

  if (payload.visitMode && !validVisitModes.has(payload.visitMode)) {
    return "visitMode is invalid";
  }

  const reportIds = Array.isArray(payload.reportIds) ? payload.reportIds : [];
  if (payload.reportIds !== undefined && payload.reportIds !== null && !Array.isArray(payload.reportIds)) {
    return "reportIds must be an array";
  }
  if (reportIds.length > 50) {
    return "Too many reports selected";
  }
  for (const id of reportIds) {
    if (!isValidObjectId(String(id))) {
      return "Each report id must be a valid MongoDB ObjectId";
    }
  }

  return null;
};

const buildConflictQuery = ({ doctorId, patientId, slotDate, slotTime, excludeId }) => {
  const query = {
    _id: excludeId ? { $ne: excludeId } : { $exists: true },
    slotDate,
    slotTime,
    status: { $ne: "cancelled" },
    $or: [{ doctorId }, { patientId }]
  };

  return query;
};

const ensureSlotAvailable = async ({ doctorId, patientId, slotDate, slotTime, excludeId }) => {
  const conflict = await Appointment.findOne(
    buildConflictQuery({ doctorId, patientId, slotDate, slotTime, excludeId })
  );

  if (!conflict) {
    return null;
  }

  if (String(conflict.doctorId) === String(doctorId)) {
    return "Doctor already has an appointment for this slot";
  }

  return "Patient already has an appointment for this slot";
};

export const createAppointment = async (req, res) => {
  try {
    const payload = parseBookingPayload(req.body);
    const validationError = ensureBookingPayload(payload);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const conflictMessage = await ensureSlotAvailable(payload);
    if (conflictMessage) {
      return res.status(409).json({ message: conflictMessage });
    }

    const reportIds = Array.isArray(payload.reportIds) ? payload.reportIds : [];

    const appointment = await Appointment.create({
      ...payload,
      reason: payload.reason || "",
      notes: payload.notes || "",
      visitMode: payload.visitMode === "telemedicine" ? "telemedicine" : "in_person",
      reportIds
    });
    const appointmentDetails = sanitizeAppointment(appointment);

    return res.status(201).json({
      message: "Appointment booked successfully",
      appointment: appointmentDetails
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create appointment", error: error.message });
  }
};

export const getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid appointment id" });
    }

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    return res.json({ appointment: sanitizeAppointment(appointment) });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch appointment", error: error.message });
  }
};

export const listAppointments = async (req, res) => {
  try {
    const { patientId, doctorId, status, paymentStatus, slotDate } = req.query;
    const { atoken } = req.headers;
    const query = {};

    if (patientId) {
      if (!isValidObjectId(patientId)) {
        return res.status(400).json({ message: "patientId must be a valid MongoDB ObjectId" });
      }
      query.patientId = patientId;
    }

    if (doctorId) {
      if (!isValidObjectId(doctorId)) {
        return res.status(400).json({ message: "doctorId must be a valid MongoDB ObjectId" });
      }
      query.doctorId = doctorId;
    }

    if (status) {
      if (!validStatuses.has(status)) {
        return res.status(400).json({ message: "status is invalid" });
      }
      query.status = status;
    }

    if (paymentStatus) {
      if (!validPaymentStatuses.has(paymentStatus)) {
        return res.status(400).json({ message: "paymentStatus is invalid" });
      }
      query.paymentStatus = paymentStatus;
    }

    if (slotDate) {
      query.slotDate = slotDate;
    }

    const appointments = await Appointment.find(query).sort({ slotDate: 1, slotTime: 1, createdAt: -1 });

    // Enrich with names if it's an admin request
    let enrichedAppointments = appointments.map(sanitizeAppointment);

    if (req.user?.role === 'admin' && atoken) {
      try {
        // Fetch doctors and patients in parallel
        const [doctorsRes, patientsRes] = await Promise.all([
          axios.post(`${process.env.DOCTOR_SERVICE_URL || 'http://localhost:4000'}/api/admin/all-doctors`, {}, { headers: { atoken } }).catch(() => ({ data: { success: false } })),
          axios.get(`${process.env.PATIENT_SERVICE_URL || 'http://localhost:8002'}/api/patients/admin/users`, { headers: { atoken } }).catch(() => ({ data: { success: false } }))
        ]);

        const doctorsMap = {};
        if (doctorsRes.data?.success) {
          doctorsRes.data.doctors.forEach(doc => {
            doctorsMap[doc._id] = doc.name;
          });
        }

        const patientsMap = {};
        if (patientsRes.data?.users) {
          patientsRes.data.users.forEach(pat => {
            patientsMap[pat.id || pat._id] = pat.name;
          });
        }

        enrichedAppointments = enrichedAppointments.map(app => ({
          ...app,
          patientName: patientsMap[app.patientId] || "Unknown Patient",
          doctorName: doctorsMap[app.doctorId] || "Unknown Doctor"
        }));
      } catch (err) {
        console.error("Enrichment failed:", err.message);
      }
    }

    return res.json({
      count: appointments.length,
      appointments: enrichedAppointments
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to list appointments", error: error.message });
  }
};

export const updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid appointment id" });
    }

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (!editableStatuses.has(appointment.status)) {
      return res.status(409).json({
        message: `Appointments with status "${appointment.status}" cannot be updated`
      });
    }

    const allowedUpdates = [
      "slotDate",
      "slotTime",
      "amount",
      "reason",
      "notes",
      "visitMode",
      "reportIds",
      "status",
      "paymentStatus"
    ];
    const updates = {};

    for (const field of allowedUpdates) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields provided for update" });
    }

    // Promote appointment to confirmed when payment becomes paid unless an explicit status is provided.
    if (updates.paymentStatus === "paid" && updates.status === undefined && appointment.status === "pending") {
      updates.status = "confirmed";
    }

    if (updates.amount !== undefined && (typeof updates.amount !== "number" || Number.isNaN(updates.amount) || updates.amount < 0)) {
      return res.status(400).json({ message: "amount must be a valid non-negative number" });
    }

    if (updates.status !== undefined && !validStatuses.has(updates.status)) {
      return res.status(400).json({ message: "status is invalid" });
    }

    if (updates.paymentStatus !== undefined && !validPaymentStatuses.has(updates.paymentStatus)) {
      return res.status(400).json({ message: "paymentStatus is invalid" });
    }

    if (updates.visitMode !== undefined && !validVisitModes.has(updates.visitMode)) {
      return res.status(400).json({ message: "visitMode is invalid" });
    }

    if (updates.reportIds !== undefined) {
      if (!Array.isArray(updates.reportIds)) {
        return res.status(400).json({ message: "reportIds must be an array" });
      }
      if (updates.reportIds.length > 50) {
        return res.status(400).json({ message: "Too many reports selected" });
      }
      for (const id of updates.reportIds) {
        if (!isValidObjectId(String(id))) {
          return res.status(400).json({ message: "Each report id must be a valid MongoDB ObjectId" });
        }
      }
    }

    const nextSlotDate = updates.slotDate || appointment.slotDate;
    const nextSlotTime = updates.slotTime || appointment.slotTime;
    const nextStatus = updates.status || appointment.status;
    const previousPaymentStatus = appointment.paymentStatus;

    if (nextStatus !== "cancelled") {
      const conflictMessage = await ensureSlotAvailable({
        doctorId: appointment.doctorId,
        patientId: appointment.patientId,
        slotDate: nextSlotDate,
        slotTime: nextSlotTime,
        excludeId: appointment._id
      });

      if (conflictMessage) {
        return res.status(409).json({ message: conflictMessage });
      }
    }

    Object.assign(appointment, updates);

    if (updates.status === "cancelled") {
      appointment.cancelledAt = new Date();
      appointment.cancelledBy = req.body.cancelledBy || "system";

      // Notify patient and doctor about cancellation
      const notifyCancellation = async () => {
        try {
          // Notify patient
          await sendNotificationToUser({
            recipientId: appointment.patientId,
            recipientRole: "patient",
            type: "appointment_cancelled_by_doctor",
            title: "Appointment Cancelled",
            body: `Your appointment with Dr. ${req.body.doctorName || "your doctor"} on ${appointment.slotDate} at ${appointment.slotTime} has been cancelled.`,
            appointmentId: appointment._id,
            appointmentDetails: sanitizeAppointment(appointment)
          });

          // Notify doctor
          await sendNotificationToUser({
            recipientId: appointment.doctorId,
            recipientRole: "doctor",
            type: "appointment_cancelled_by_doctor",
            title: "Appointment Cancelled",
            body: `The appointment for ${appointment.slotDate} at ${appointment.slotTime} has been cancelled.`,
            appointmentId: appointment._id,
            appointmentDetails: sanitizeAppointment(appointment)
          });
        } catch (error) {
          console.error("Failed to send cancellation notifications:", error.message);
        }
      };
      notifyCancellation();
    }

    await appointment.save();

    const becamePaid = previousPaymentStatus !== "paid" && appointment.paymentStatus === "paid";

    if (becamePaid) {
      await sendNotificationToUser({
        recipientId: appointment.patientId,
        recipientRole: "patient",
        type: "appointment_booked",
        title: "Appointment Confirmed",
        body: `Your appointment is confirmed for ${appointment.slotDate} at ${appointment.slotTime}.`,
        appointmentId: appointment._id,
        appointmentDetails: {
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          slotDate: appointment.slotDate,
          slotTime: appointment.slotTime,
          paymentStatus: appointment.paymentStatus,
          visitMode: appointment.visitMode,
          reason: appointment.reason
        }
      });

      await sendNotificationToUser({
        recipientId: appointment.doctorId,
        recipientRole: "doctor",
        type: "appointment_booked",
        title: "New Appointment Scheduled",
        body: `A new appointment has been scheduled for ${appointment.slotDate} at ${appointment.slotTime}.`,
        appointmentId: appointment._id,
        appointmentDetails: {
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          slotDate: appointment.slotDate,
          slotTime: appointment.slotTime,
          paymentStatus: appointment.paymentStatus,
          visitMode: appointment.visitMode,
          reason: appointment.reason
        }
      });
    }

    return res.json({
      message: "Appointment updated successfully",
      appointment: sanitizeAppointment(appointment)
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update appointment", error: error.message });
  }
};

export const updatePatientAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid appointment id" });
    }

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (req.body.patientId === undefined || req.body.patientId === null || req.body.patientId === "") {
      return res.status(400).json({ message: "patientId is required" });
    }
    if (String(appointment.patientId) !== String(req.body.patientId)) {
      return res.status(403).json({ message: "You can only update your own appointments" });
    }

    if (!editableStatuses.has(appointment.status)) {
      return res.status(409).json({
        message: `Appointments with status "${appointment.status}" cannot be updated`
      });
    }

    // Patient-scoped update: only reason and shared report ids are editable.
    const updates = {};
    if (req.body.reason !== undefined) {
      updates.reason = String(req.body.reason);
    }
    if (req.body.reportIds !== undefined) {
      if (!Array.isArray(req.body.reportIds)) {
        return res.status(400).json({ message: "reportIds must be an array" });
      }
      if (req.body.reportIds.length > 50) {
        return res.status(400).json({ message: "Too many reports selected" });
      }
      for (const reportId of req.body.reportIds) {
        if (!isValidObjectId(String(reportId))) {
          return res.status(400).json({ message: "Each report id must be a valid MongoDB ObjectId" });
        }
      }
      updates.reportIds = req.body.reportIds;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields provided. Only reason and reportIds are allowed." });
    }

    Object.assign(appointment, updates);
    await appointment.save();

    return res.json({
      message: "Appointment details updated successfully",
      appointment: sanitizeAppointment(appointment)
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update appointment details", error: error.message });
  }
};

export const cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid appointment id" });
    }

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (appointment.status === "cancelled") {
      return res.status(409).json({ message: "Appointment is already cancelled" });
    }

    if (appointment.status === "completed") {
      return res.status(409).json({ message: "Completed appointments cannot be cancelled" });
    }

    appointment.status = "cancelled";
    appointment.cancelledAt = new Date();
    appointment.cancelledBy = req.body.cancelledBy || "system";
    if (req.body.notes !== undefined) {
      appointment.notes = req.body.notes;
    }

    await appointment.save();

    // Send notifications to both patient and doctor
    const notifyCancellation = async () => {
      try {
        const type = appointment.cancelledBy === "patient" ? "appointment_cancelled_by_patient" : "appointment_cancelled_by_doctor";
        
        // Notify patient
        await sendNotificationToUser({
          recipientId: appointment.patientId,
          recipientRole: "patient",
          type: type,
          title: "Appointment Cancelled",
          body: `Your appointment on ${appointment.slotDate} at ${appointment.slotTime} has been cancelled.`,
          appointmentId: appointment._id,
          appointmentDetails: sanitizeAppointment(appointment)
        });

        // Notify doctor
        await sendNotificationToUser({
          recipientId: appointment.doctorId,
          recipientRole: "doctor",
          type: type,
          title: "Appointment Cancelled",
          body: `The appointment for ${appointment.slotDate} at ${appointment.slotTime} has been cancelled.`,
          appointmentId: appointment._id,
          appointmentDetails: sanitizeAppointment(appointment)
        });
      } catch (error) {
        console.error("Failed to send cancellation notifications:", error.message);
      }
    };
    notifyCancellation();

    return res.json({
      message: "Appointment cancelled successfully",
      appointment: sanitizeAppointment(appointment)
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to cancel appointment", error: error.message });
  }
};

export const getAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid appointment id" });
    }

    const appointment = await Appointment.findById(id).select("status paymentStatus slotDate slotTime cancelledAt cancelledBy updatedAt");
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    return res.json({
      appointmentId: appointment._id,
      status: appointment.status,
      paymentStatus: appointment.paymentStatus,
      slotDate: appointment.slotDate,
      slotTime: appointment.slotTime,
      cancelledAt: appointment.cancelledAt,
      cancelledBy: appointment.cancelledBy,
      updatedAt: appointment.updatedAt
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch appointment status", error: error.message });
  }
};
