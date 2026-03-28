import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    mongoose.connection.on("connected", () =>
      console.log("Doctor Service MongoDB Connected")
    );

    mongoose.connection.on("error", (err) =>
      console.log("MongoDB Error:", err)
    );

    await mongoose.connect(`${process.env.MONGODB_URL}/doctor-db`);

  } catch (error) {
    console.log("Error connecting to MongoDB", error);
  }
};