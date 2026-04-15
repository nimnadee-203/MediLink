import mongoose from "mongoose";

const getDbName = () => process.env.NOTIFICATION_DB_NAME || "notification-db";

/**
 * Always use NOTIFICATION_DB_NAME as the database name, even if MONGO_URI already
 * contains another database (e.g. copied from patient/doctor .env).
 */
const buildMongoUri = () => {
  const rawUri = process.env.MONGO_URI || process.env.MONGODB_URL;
  const dbName = getDbName();

  if (!rawUri) {
    throw new Error("Missing MongoDB connection string. Set MONGO_URI or MONGODB_URL.");
  }

  if (!/^mongodb(\+srv)?:\/\//.test(rawUri)) {
    throw new Error(
      'Invalid MongoDB connection string. It must start with "mongodb://" or "mongodb+srv://".'
    );
  }

  const qIndex = rawUri.indexOf("?");
  const query = qIndex !== -1 ? rawUri.slice(qIndex) : "";
  const withoutQuery = qIndex !== -1 ? rawUri.slice(0, qIndex) : rawUri;

  const m = withoutQuery.match(/^(mongodb(\+srv)?:\/\/[^/]+)(\/[^/]*)?$/);
  if (!m) {
    throw new Error("Could not parse MongoDB URI. Check MONGO_URI / MONGODB_URL.");
  }

  const base = m[1];
  return `${base}/${dbName}${query}`;
};

export const connectDB = async () => {
  try {
    mongoose.set("strictQuery", true);

    mongoose.connection.on("connected", () =>
      console.log("Notification Service MongoDB Connected")
    );

    mongoose.connection.on("error", (err) =>
      console.log("MongoDB Error:", err)
    );

    await mongoose.connect(buildMongoUri(), {
      serverSelectionTimeoutMS: 10_000
    });
  } catch (error) {
    console.log("Error connecting to MongoDB", error);
    throw error;
  }
};
