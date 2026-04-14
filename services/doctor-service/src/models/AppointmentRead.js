import mongoose from "mongoose";

const appointmentReadSchema = new mongoose.Schema(
  {
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
    reason: { type: String, default: "" },
    visitMode: {
      type: String,
      enum: ["in_person", "telemedicine"],
      default: "in_person"
    },
    reportIds: {
      type: [mongoose.Schema.Types.ObjectId],
      default: []
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
    }
  },
  { timestamps: true, collection: "appointments" }
);

const appointmentDbName = process.env.APPOINTMENT_DB_NAME || "appointment-db";

let cachedModel = null;

function resolveModel() {
  if (cachedModel) {
    return cachedModel;
  }
  if (mongoose.connection.readyState !== 1) {
    throw new Error("MongoDB must be connected before using AppointmentRead");
  }
  const appointmentDb = mongoose.connection.useDb(appointmentDbName, { useCache: true });
  cachedModel = appointmentDb.model("AppointmentRead", appointmentReadSchema);
  return cachedModel;
}

/** Lazy model: `useDb` must run after `mongoose.connect`, not at module load time. */
export default new Proxy(
  {},
  {
    get(_target, prop) {
      const Model = resolveModel();
      const value = Model[prop];
      return typeof value === "function" ? value.bind(Model) : value;
    }
  }
);
