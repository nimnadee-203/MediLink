import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URL || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("Missing MONGODB_URL or MONGO_URI in environment");
    }

    mongoose.set("strictQuery", true);

    mongoose.connection.on("connected", () =>
      console.log("Telemedicine Service MongoDB Connected")
    );

    mongoose.connection.on("error", (err) =>
      console.log("MongoDB Error:", err)
    );

    await mongoose.connect(mongoUri);

  } catch (error) {
    console.log("Error connecting to MongoDB", error);
  }
};
