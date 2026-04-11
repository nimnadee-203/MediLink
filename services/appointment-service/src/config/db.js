import mongoose from "mongoose";

const getAppointmentDbName = () => process.env.APPOINTMENT_DB_NAME || "appointment-db";

const buildMongoUri = () => {
  const rawUri = process.env.MONGO_URI || process.env.MONGODB_URL;
  const dbName = getAppointmentDbName();

  if (!rawUri) {
    throw new Error("Missing MongoDB connection string. Set MONGO_URI in .env.");
  }

  if (!/^mongodb(\+srv)?:\/\//.test(rawUri)) {
    throw new Error(
      'Invalid MongoDB connection string. It must start with "mongodb://" or "mongodb+srv://".'
    );
  }

  const hasDatabaseInPath = /mongodb(\+srv)?:\/\/[^/]+\/[^?]+/.test(rawUri);
  if (hasDatabaseInPath) {
    return rawUri;
  }

  if (rawUri.includes("/?")) {
    return rawUri.replace("/?", `/${dbName}?`);
  }

  if (rawUri.endsWith("/")) {
    return `${rawUri}${dbName}`;
  }

  return `${rawUri}/${dbName}`;
};

export const connectDB = async () => {
  try {
    mongoose.set("strictQuery", false);

    mongoose.connection.on("connected", () =>
      console.log("Appointment Service MongoDB Connected")
    );

    mongoose.connection.on("error", (err) =>
      console.log("MongoDB Error:", err)
    );

    await mongoose.connect(buildMongoUri());
  } catch (error) {
    console.log("Error connecting to MongoDB", error);
    throw error;
  }
};
