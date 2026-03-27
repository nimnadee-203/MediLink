import mongoose from "mongoose";

const doctorSchema = new mongoose.Schema(
{
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  speciality: { type: String, required: true },
  degree: { type: String, required: true },
  experience: { type: String, required: true },
  about: { type: String, required: true },

  available: {
    type: Boolean,
    default: true
  },

  fees: {
    type: Number,
    required: true
  },

  address: {
    line1: String,
    line2: String
  },

  slots_booked: {
    type: Object,
    default: {}
  },

  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  }

},
{ timestamps: true }
);

export default mongoose.model("Doctor", doctorSchema);