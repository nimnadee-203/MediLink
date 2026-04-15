import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    recipientRole: {
      type: String,
      enum: ["patient", "doctor"],
      required: true,
      index: true
    },
    type: {
      type: String,
      trim: true,
      default: "general"
    },
    title: { type: String, required: true, trim: true },
    body: { type: String, default: "", trim: true },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    read: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

notificationSchema.index({ recipientId: 1, recipientRole: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
