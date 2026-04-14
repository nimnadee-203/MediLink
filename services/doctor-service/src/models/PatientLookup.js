import mongoose from "mongoose";

const patientLookupSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, default: "" }
  },
  { collection: "patients", strict: false }
);

let cachedModel = null;

function resolveModel() {
  if (cachedModel) {
    return cachedModel;
  }
  if (mongoose.connection.readyState !== 1) {
    throw new Error("MongoDB must be connected before using PatientLookup");
  }
  const conn = process.env.PATIENT_DB_NAME
    ? mongoose.connection.useDb(process.env.PATIENT_DB_NAME, { useCache: true })
    : mongoose.connection;
  cachedModel = conn.model("PatientLookup", patientLookupSchema);
  return cachedModel;
}

/**
 * Patient documents (and embedded `reports`) live on the default DB or PATIENT_DB_NAME
 * when patient-service uses a different database on the same cluster.
 */
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
