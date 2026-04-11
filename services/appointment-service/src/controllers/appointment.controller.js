import mongoose from "mongoose";
import Appointment from "../models/Appointment.js";

const editableStatuses = new Set(["pending", "confirmed"]);
const validStatuses = new Set(["pending", "confirmed", "cancelled", "completed"]);
const validPaymentStatuses = new Set(["pending", "paid", "failed", "refunded"]);

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

    const appointment = await Appointment.create({
      ...payload,
      reason: payload.reason || "",
      notes: payload.notes || ""
    });

    return res.status(201).json({
      message: "Appointment booked successfully",
      appointment: sanitizeAppointment(appointment)
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

    return res.json({
      count: appointments.length,
      appointments: appointments.map(sanitizeAppointment)
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

    const allowedUpdates = ["slotDate", "slotTime", "amount", "reason", "notes", "status", "paymentStatus"];
    const updates = {};

    for (const field of allowedUpdates) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields provided for update" });
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

    const nextSlotDate = updates.slotDate || appointment.slotDate;
    const nextSlotTime = updates.slotTime || appointment.slotTime;
    const nextStatus = updates.status || appointment.status;

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
    }

    await appointment.save();

    return res.json({
      message: "Appointment updated successfully",
      appointment: sanitizeAppointment(appointment)
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update appointment", error: error.message });
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
