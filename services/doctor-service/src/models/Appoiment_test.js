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

  status: {
    type: String,
    enum: ["pending", "confirmed", "cancelled", "completed"],
    default: "pending"
  },

  paymentStatus: {
    type: String,
    enum: ["pending", "paid"],
    default: "pending"
  }

},
{ timestamps: true });

export default mongoose.model("Appoiment", appointmentSchema);