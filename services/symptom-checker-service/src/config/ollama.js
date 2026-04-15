export const analyzeWithOllama = async (symptoms) => {
  try {
    const symptomText = symptoms.join(", ");
    
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mistral',
        prompt: `You are a medical assistant. A patient reports these symptoms: "${symptomText}".

Analyze and respond ONLY with valid JSON (no markdown, no extra text, no explanation):
{
  "possibleConditions": ["condition1", "condition2"],
  "recommendedDoctors": ["doctor_type1", "doctor_type2"],
  "severity": "mild|moderate|severe"
}`,
        stream: false,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract JSON from response (handles cases where model adds extra text)
    const jsonMatch = data.response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      possibleConditions: parsed.possibleConditions || [],
      recommendedDoctors: parsed.recommendedDoctors || [],
      severity: parsed.severity || 'unknown',
      matchScore: 85, // Ollama doesn't provide match score, set default
      source: 'ollama'
    };
  } catch (error) {
    console.error('Ollama analysis error:', error.message);
    throw new Error(`Ollama service unavailable: ${error.message}. Make sure Ollama is running on http://localhost:11434`);
  }
};
