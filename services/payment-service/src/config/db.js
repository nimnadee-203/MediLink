import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    mongoose.connection.on("connected", () =>
      console.log("Payment Service MongoDB Connected")
    );

    mongoose.connection.on("error", (err) =>
      console.log("MongoDB Error:", err)
    );

    await mongoose.connect(`${process.env.MONGODB_URL}/payment-db`);

  } catch (error) {
    console.log("Error connecting to MongoDB", error);
  }
};
