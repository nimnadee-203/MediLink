// Rule-based symptom to condition mapping
export const symptomMappings = [
  {
    id: "cold-flu",
    conditions: ["Common Cold", "Flu"],
    recommendedDoctors: ["General Practitioner", "Internal Medicine Specialist"],
    symptoms: ["fever", "cough", "sore throat", "runny nose", "sneezing", "fatigue"],
  },
  {
    id: "headache-migraine",
    conditions: ["Headache", "Migraine", "Tension Headache"],
    recommendedDoctors: ["Neurologist", "General Practitioner"],
    symptoms: ["headache", "head pain", "migraine", "throbbing pain", "light sensitivity"],
  },
  {
    id: "stomach-issue",
    conditions: ["Gastroenteritis", "Indigestion", "Food Poisoning"],
    recommendedDoctors: ["Gastroenterologist", "General Practitioner"],
    symptoms: ["nausea", "vomiting", "stomach pain", "diarrhea", "abdominal pain", "indigestion"],
  },
  {
    id: "skin-issue",
    conditions: ["Dermatitis", "Eczema", "Psoriasis", "Acne"],
    recommendedDoctors: ["Dermatologist"],
    symptoms: ["rash", "itching", "skin irritation", "acne", "dry skin", "redness"],
  },
  {
    id: "joint-pain",
    conditions: ["Arthritis", "Joint Pain", "Inflammation"],
    recommendedDoctors: ["Rheumatologist", "Orthopedist", "General Practitioner"],
    symptoms: ["joint pain", "stiffness", "arthritis", "knee pain", "back pain", "inflammation"],
  },
  {
    id: "respiratory",
    conditions: ["Asthma", "Bronchitis", "Respiratory Infection"],
    recommendedDoctors: ["Pulmonologist", "General Practitioner"],
    symptoms: ["shortness of breath", "wheezing", "breathing difficulty", "chest tightness", "persistent cough"],
  },
  {
    id: "allergy",
    conditions: ["Allergic Reaction", "Hay Fever", "Contact Dermatitis"],
    recommendedDoctors: ["Allergist", "Immunologist", "General Practitioner"],
    symptoms: ["itching", "hives", "allergic reaction", "sneezing", "watery eyes", "runny nose"],
  },
  {
    id: "anxiety-stress",
    conditions: ["Anxiety", "Stress", "Sleep Disorder"],
    recommendedDoctors: ["Psychiatrist", "Psychologist", "General Practitioner"],
    symptoms: ["anxiety", "stress", "panic", "insomnia", "nervousness", "worry"],
  },
];

export const checkSymptoms = (userSymptoms) => {
  if (!userSymptoms || userSymptoms.length === 0) {
    return [];
  }

  // Normalize user input to lowercase
  const normalizedUserSymptoms = userSymptoms.map((s) => s.toLowerCase().trim());

  // Score each condition based on symptom matches
  const results = [];

  for (const mapping of symptomMappings) {
    let matchCount = 0;
    const matchedSymptoms = [];

    for (const userSymptom of normalizedUserSymptoms) {
      const found = mapping.symptoms.find((mappedSymptom) =>
        mappedSymptom.toLowerCase().includes(userSymptom) ||
        userSymptom.includes(mappedSymptom.toLowerCase())
      );

      if (found) {
        matchCount++;
        matchedSymptoms.push(found);
      }
    }

    // Only include if at least 1 symptom matches
    if (matchCount > 0) {
      results.push({
        id: mapping.id,
        matchScore: (matchCount / mapping.symptoms.length) * 100,
        matchedSymptomsCount: matchCount,
        possibleConditions: mapping.conditions,
        recommendedDoctors: mapping.recommendedDoctors,
      });
    }
  }

  // Sort by match score (highest first)
  return results.sort((a, b) => b.matchScore - a.matchScore);
};
