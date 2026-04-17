import mongoose from "mongoose";

const medicationSchema = new mongoose.Schema(
{
		drugName: { type: String, required: true, trim: true },
		dosage: { type: String, trim: true, default: "" },
		frequency: { type: String, trim: true, default: "" },
		duration: { type: String, trim: true, default: "" },
		notes: { type: String, trim: true, default: "" }
	},
	{ _id: false }
);

const prescriptionSchema = new mongoose.Schema(
	{
		doctorId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
		patientId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
		appointmentId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
		medications: { type: [medicationSchema], default: [] },
		generalInstructions: { type: String, trim: true, default: "" }
	},
	{ timestamps: true }
);

export default mongoose.model("Prescription", prescriptionSchema);