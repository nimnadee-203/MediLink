import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
{
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  role: {
    type: String,
    enum: ["admin", "doctor", "patient"],
    default: "patient",
  },

  status: {
    type: String,
    enum: ["active", "pending", "blocked"],
    default: "active",
  },

  image: {
    type: String,
    default: "",
  },

  address: {
    line1: String,
    line2: String,
  },

  gender: {
    type: String,
    default: "Not Selected",
  },

  dob: {
    type: String,
    default: "Not Selected",
  },

  phone: {
    type: String,
    default: "",
  },

},
{ timestamps: true }
);

export default mongoose.model("User", userSchema);