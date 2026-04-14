import mongoose from "mongoose";

export const connectDB = async () => {
  const mongoUri = (process.env.MONGO_URI || process.env.MONGODB_URL || "").trim();
  const dbName = (process.env.MONGO_DB_NAME || "symptom-checker").trim();

  if (!mongoUri.startsWith("mongodb://") && !mongoUri.startsWith("mongodb+srv://")) {
    console.log(
      "Invalid or missing MongoDB URI. Set MONGO_URI (or MONGODB_URL) to a valid mongodb:// or mongodb+srv:// connection string."
    );
    return;
  }

  try {
    mongoose.connection.on("connected", () =>
      console.log("Symptom Checker Service MongoDB Connected")
    );

    mongoose.connection.on("error", (err) =>
      console.log("MongoDB Error:", err)
    );

    await mongoose.connect(mongoUri, { dbName });
    console.log(`Symptom Checker Service connected to database: ${dbName}`);

  } catch (error) {
    console.log("Error connecting to MongoDB", error);
  }
};
