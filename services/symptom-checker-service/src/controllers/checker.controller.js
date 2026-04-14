import { checkSymptoms } from "../config/symptoms.js";
import { analyzeWithOllama } from "../config/ollama.js";
import CheckHistory from "../models/checkHistory.js";

export const analyzeSymptoms = async (req, res) => {
  try {
    const { userId, symptoms, notes, useAI } = req.body;

    if (!userId || !symptoms || symptoms.length === 0) {
      return res.status(400).json({ error: "userId and symptoms array are required" });
    }

    let analysisResults;
    let analysisMethod = 'rule-based';

    // Try AI-powered analysis if requested
    if (useAI) {
      try {
        console.log('Using Ollama AI for analysis...');
        const ollamaResult = await analyzeWithOllama(symptoms);
        analysisResults = [ollamaResult];
        analysisMethod = 'ollama-ai';
      } catch (error) {
        console.warn('Ollama failed, falling back to rule-based:', error.message);
        analysisResults = checkSymptoms(symptoms);
        analysisMethod = 'rule-based-fallback';
      }
    } else {
      // Use rule-based analysis by default
      analysisResults = checkSymptoms(symptoms);
    }

    // Save check history
    const checkRecord = new CheckHistory({
      userId,
      userSymptoms: symptoms,
      results: analysisResults,
      notes: notes || "",
      analysisMethod: analysisMethod,
    });

    const savedRecord = await checkRecord.save();

    res.status(200).json({
      success: true,
      message: "Symptom analysis completed",
      analysis: analysisResults,
      historyId: savedRecord._id,
      analysisMethod: analysisMethod,
      disclaimer:
        "This is a basic symptom checker for informational purposes only. Please consult a licensed healthcare provider for accurate diagnosis and treatment.",
    });
  } catch (error) {
    console.error("Failed to analyze symptoms", error);
    res.status(500).json({ error: error.message });
  }
};

export const getCheckHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const history = await CheckHistory.find({ userId: userId }).sort({ createdAt: -1 }).limit(10);

    res.status(200).json({
      success: true,
      history,
    });
  } catch (error) {
    console.error("Failed to fetch check history", error);
    res.status(500).json({ error: error.message });
  }
};
