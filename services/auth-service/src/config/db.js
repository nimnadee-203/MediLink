import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URL;
    if (!mongoUri) {
      throw new Error("Missing MONGODB_URL or MONGO_URI in environment");
    }

    mongoose.set("strictQuery", true);

    mongoose.connection.on("connected", () =>
      console.log("Auth Service MongoDB Connected")
    );

    mongoose.connection.on("error", (err) =>
      console.log("MongoDB Error:", err)
    );

    await mongoose.connect(mongoUri);

  } catch (error) {
    console.log("Error connecting to MongoDB", error);
  }
};