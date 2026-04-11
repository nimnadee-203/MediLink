import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true
  },

  slotDate: { type: String, required: true },
  slotTime: { type: String, required: true },

  amount: { type: Number, required: true },
  reason: {
    type: String,
    trim: true,
    default: ""
  },
  notes: {
    type: String,
    trim: true,
    default: ""
  },

  status: {
    type: String,
    enum: ["pending", "confirmed", "cancelled", "completed"],
    default: "pending"
  },

  paymentStatus: {
    type: String,
    enum: ["pending", "paid", "failed", "refunded"],
    default: "pending"
  },

  cancelledAt: {
    type: Date,
    default: null
  },

  cancelledBy: {
    type: String,
    trim: true,
    default: null
  }
},
{ timestamps: true });

appointmentSchema.index(
  { doctorId: 1, slotDate: 1, slotTime: 1 },
  { unique: true, partialFilterExpression: { status: { $ne: "cancelled" } } }
);

appointmentSchema.index({ patientId: 1, createdAt: -1 });
appointmentSchema.index({ doctorId: 1, createdAt: -1 });
appointmentSchema.index({ status: 1, slotDate: 1 });

export default mongoose.model("Appointment", appointmentSchema);
