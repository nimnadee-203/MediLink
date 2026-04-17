import mongoose from "mongoose";

const doctorSchema = new mongoose.Schema(
{
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false
  },

  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  clerkUserId: { type: String, unique: true, sparse: true },
  password: { type: String, required: true },
  image: { type: String, required: true },
  speciality: { type: String, required: true },
  degree: { type: String, required: true },
  experience: { type: String, required: true },
  about: { type: String, required: true },

  consultationMode: {
    type: String,
    enum: ["in_person_only", "both"],
    default: "in_person_only"
  },

  available: {
    type: Boolean,
    default: true
  },

  fees: {
    type: Number,
    required: true
  },

  address: {
    type: String
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

const doctorDb = mongoose.connection.useDb(process.env.DOCTOR_DB_NAME || 'doctors', { useCache: true });

const Doctor = doctorDb.models.Doctor || doctorDb.model('Doctor', doctorSchema, 'doctors');

export default Doctor;