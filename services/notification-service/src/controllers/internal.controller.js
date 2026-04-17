import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import { sendNotificationEmail } from "../services/notificationEmailService.js";

const isValidObjectId = (v) => mongoose.Types.ObjectId.isValid(String(v));

/**
 * Fetch appointment details from appointment service
 */
async function fetchAppointmentDetails(appointmentId) {
  try {
    const response = await fetch(`http://localhost:8003/api/appointments/${appointmentId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });
    if (response.ok) {
      const data = await response.json();
      return data.appointment;
    }
  } catch (error) {
    console.error(`[notification-service] Failed to fetch appointment ${appointmentId}:`, error.message);
  }
  return null;
}

export const createNotification = async (req, res) => {
  try {
    const { recipientId, recipientRole, type, title, body, appointmentId, appointmentDetails } = req.body;

    if (type === "appointment_booked") {
      const paidStatus = String(appointmentDetails?.paymentStatus || "").toLowerCase();
      if (paidStatus !== "paid") {
        return res.status(202).json({
          success: true,
          skipped: true,
          message: "appointment_booked notification suppressed until payment is paid"
        });
      }
    }

    if (!recipientId || !recipientRole || !title) {
      return res.status(400).json({
        success: false,
        message: "recipientId, recipientRole, and title are required"
      });
    }

    if (!["patient", "doctor"].includes(recipientRole)) {
      return res.status(400).json({ success: false, message: "recipientRole must be patient or doctor" });
    }

    if (!isValidObjectId(recipientId)) {
      return res.status(400).json({ success: false, message: "recipientId must be a valid id" });
    }

    if (appointmentId != null && appointmentId !== "" && !isValidObjectId(appointmentId)) {
      return res.status(400).json({ success: false, message: "appointmentId must be a valid id" });
    }

    const doc = await Notification.create({
      recipientId: new mongoose.Types.ObjectId(String(recipientId)),
      recipientRole,
      type: type || "general",
      title: String(title).slice(0, 200),
      body: body != null ? String(body).slice(0, 2000) : "",
      appointmentId: appointmentId ? new mongoose.Types.ObjectId(String(appointmentId)) : undefined,
      read: false
    });

    // Send email notification asynchronously (don't wait for it)
    if (type && type.includes("appointment")) {
      let appointmentData = appointmentDetails;
      
      if (!appointmentData && appointmentId) {
        appointmentData = await fetchAppointmentDetails(appointmentId);
      }

      if (appointmentData) {
        sendNotificationEmail(
          {
            recipientId,
            recipientRole,
            type
          },
          appointmentData
        ).catch((err) => {
          console.error("[notification-service] Email send failed (non-blocking):", err.message);
        });
      }
    }

    return res.status(201).json({
      success: true,
      notification: {
        id: String(doc._id),
        title: doc.title,
        body: doc.body,
        type: doc.type,
        read: doc.read,
        createdAt: doc.createdAt
      }
    });
  } catch (error) {
    console.error("[notification-service] createNotification", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const listNotifications = async (req, res) => {
  try {
    const { recipientId, recipientRole, limit = "50" } = req.query;

    if (!recipientId || !recipientRole) {
      return res.status(400).json({ success: false, message: "recipientId and recipientRole are required" });
    }

    if (!["patient", "doctor"].includes(recipientRole)) {
      return res.status(400).json({ success: false, message: "invalid recipientRole" });
    }

    if (!isValidObjectId(recipientId)) {
      return res.status(400).json({ success: false, message: "invalid recipientId" });
    }

    const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

    const rid = new mongoose.Types.ObjectId(String(recipientId));

    const notifications = await Notification.find({ recipientId: rid, recipientRole })
      .sort({ createdAt: -1 })
      .limit(lim)
      .lean();

    const unreadCount = await Notification.countDocuments({
      recipientId: rid,
      recipientRole,
      read: false
    });

    return res.json({
      success: true,
      unreadCount,
      notifications: notifications.map((n) => ({
        id: String(n._id),
        type: n.type,
        title: n.title,
        body: n.body,
        appointmentId: n.appointmentId ? String(n.appointmentId) : null,
        read: n.read,
        createdAt: n.createdAt
      }))
    });
  } catch (error) {
    console.error("[notification-service] listNotifications", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const { recipientId, recipientRole } = req.body || {};

    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "invalid notification id" });
    }

    if (!recipientId || !recipientRole) {
      return res.status(400).json({ success: false, message: "recipientId and recipientRole are required" });
    }

    if (!["patient", "doctor"].includes(recipientRole)) {
      return res.status(400).json({ success: false, message: "invalid recipientRole" });
    }

    const result = await Notification.updateOne(
      {
        _id: new mongoose.Types.ObjectId(String(id)),
        recipientId: new mongoose.Types.ObjectId(String(recipientId)),
        recipientRole
      },
      { $set: { read: true } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("[notification-service] markNotificationRead", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
