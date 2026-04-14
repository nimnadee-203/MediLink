import mongoose from "mongoose";

const checkHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    userSymptoms: {
      type: [String],
      required: true,
    },
    results: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    notes: {
      type: String,
    },
    analysisMethod: {
      type: String,
      enum: ['rule-based', 'ollama-ai', 'rule-based-fallback'],
      default: 'rule-based'
    },
  },
  { timestamps: true }
);

export default mongoose.model("CheckHistory", checkHistorySchema);
