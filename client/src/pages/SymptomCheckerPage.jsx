import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, Sparkles, Stethoscope, X } from 'lucide-react';
import { Button, Card } from '../components/ui';

/** Symptom API: gateway /api/checker → service /checker (or /history, /analyze at root on8010). */
const gatewayOrigin = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:8000';

function resolveSymptomCheckerApiBase() {
  const raw = import.meta.env.VITE_SYMPTOM_CHECKER_API_BASE_URL;
  if (!raw || !String(raw).trim()) {
    return `${gatewayOrigin}/api/checker`;
  }
  const base = String(raw).trim().replace(/\/+$/, '');
  if (/\/checker$/i.test(base)) {
    return base;
  }
  return `${base}/checker`;
}

const symptomCheckerApiBase = resolveSymptomCheckerApiBase();

const quickSymptoms = [
  'fever',
  'cough',
  'sore throat',
  'headache',
  'shortness of breath',
  'chest tightness',
  'stomach pain',
  'nausea',
  'diarrhea',
  'rash',
  'joint pain',
  'fatigue'
];

const RECOMMENDED_DOCTOR_TO_SPECIALITY = {
  'General Practitioner': 'General Physician',
  'Internal Medicine Specialist': 'General Physician',
  Pulmonologist: 'General Physician',
  Allergist: 'General Physician',
  Immunologist: 'General Physician',
  Gastroenterologist: 'General Physician',
  Psychiatrist: 'General Physician',
  Psychologist: 'General Physician',
  Orthopedist: 'Orthopedic',
  Rheumatologist: 'Orthopedic',
  Neurologist: 'Neurologist',
  Cardiologist: 'Cardiologist',
  Dermatologist: 'Dermatologist',
  Pediatrician: 'Pediatrician',
  Gynecologist: 'Gynecologist',
  'ENT Specialist': 'ENT Specialist'
};

const formatDateTime = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value || 'N/A';
  return parsed.toLocaleString();
};

const formatPercent = (value) => {
  const num = Number(value);
  if (Number.isNaN(num)) return 'N/A';
  return `${Math.round(num)}%`;
};

export default function SymptomCheckerPage({ patient, clerkUserId }) {
  const navigate = useNavigate();

  const userId = useMemo(() => {
    if (patient?.id) return String(patient.id);
    if (patient?._id) return String(patient._id);
    if (patient?.clerkUserId) return String(patient.clerkUserId);
    if (clerkUserId) return String(clerkUserId);
    return '';
  }, [patient, clerkUserId]);

  const [symptomInput, setSymptomInput] = useState('');
  const [symptoms, setSymptoms] = useState([]);
  const [notes, setNotes] = useState('');
  const [useAI, setUseAI] = useState(true);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  const addSymptom = (rawValue) => {
    const value = String(rawValue || '').trim().toLowerCase();
    if (!value) return;
    if (symptoms.includes(value)) return;
    setSymptoms((current) => [...current, value]);
  };

  const removeSymptom = (value) => {
    setSymptoms((current) => current.filter((item) => item !== value));
  };

  const onAddSymptomFromInput = () => {
    addSymptom(symptomInput);
    setSymptomInput('');
  };

  const fetchHistory = async () => {
    if (!userId) return;

    try {
      setHistoryLoading(true);
      const response = await fetch(`${symptomCheckerApiBase}/history/${encodeURIComponent(userId)}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Failed to fetch history (${response.status})`);
      }

      setHistory(Array.isArray(data.history) ? data.history : []);
    } catch (fetchError) {
      const msg = fetchError.message || 'Failed to fetch symptom check history';
      const hint =
        msg === 'Failed to fetch' || msg === 'NetworkError when attempting to fetch resource.'
          ? ' Start the API gateway (8000) and symptom-checker-service (8010), or set VITE_SYMPTOM_CHECKER_API_BASE_URL in client/.env.'
          : '';
      setError(`${msg}${hint}`);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [userId]);

  const onAnalyze = async (event) => {
    event.preventDefault();
    setError('');

    if (!userId) {
      setError('User profile is not loaded yet. Please open Profile once, then try again.');
      return;
    }

    if (symptoms.length === 0) {
      setError('Add at least one symptom to start analysis.');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${symptomCheckerApiBase}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          symptoms,
          notes,
          useAI
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Analysis failed (${response.status})`);
      }

      setResult(data);
      fetchHistory();
    } catch (analyzeError) {
      const msg = analyzeError.message || 'Failed to analyze symptoms';
      const hint =
        msg === 'Failed to fetch' || msg === 'NetworkError when attempting to fetch resource.'
          ? ' Start the API gateway (8000) and symptom-checker-service (8010), or set VITE_SYMPTOM_CHECKER_API_BASE_URL in client/.env.'
          : '';
      setError(`${msg}${hint}`);
    } finally {
      setLoading(false);
    }
  };

  const analysisItems = Array.isArray(result?.analysis) ? result.analysis : [];

  const getRelevantSpecialities = () => {
    const recommendedDoctors = analysisItems.flatMap((item) => item?.recommendedDoctors || []);

    const mapped = recommendedDoctors
      .map((doctorType) => RECOMMENDED_DOCTOR_TO_SPECIALITY[doctorType] || null)
      .filter(Boolean);

    return Array.from(new Set(mapped));
  };

  const navigateToRelevantDoctors = () => {
    const relevantSpecialities = getRelevantSpecialities();

    if (relevantSpecialities.length === 0) {
      navigate('/doctors');
      return;
    }

    const param = encodeURIComponent(relevantSpecialities.join(','));
    navigate(`/doctors?specialities=${param}`);
  };

  return (
    <div className="max-w-6xl mx-auto relative overflow-hidden rounded-[2rem] border border-blue-800/40 p-4 md:p-6 shadow-2xl shadow-blue-950/30 bg-gradient-to-br from-blue-950 via-indigo-950 to-slate-900">
      <div className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-blue-500/25 blur-3xl" aria-hidden="true" />
      <div className="absolute top-10 right-0 h-80 w-80 rounded-full bg-indigo-500/25 blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" aria-hidden="true" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/20" aria-hidden="true" />

      <div className="relative z-10 grid lg:grid-cols-[1.05fr_0.95fr] gap-6">
      <Card className="rounded-3xl border-blue-100/90 shadow-lg shadow-blue-900/5 bg-white/92 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">AI Assistant</p>
            <h1 className="mt-2 text-2xl font-extrabold text-slate-900 tracking-tight">Symptom Checker</h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Add symptoms and get possible diagnosis suggestions with recommended doctor specialties.
            </p>
          </div>
          <span className="rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1.5">
            <Sparkles size={14} /> {useAI ? 'AI On' : 'Rules Only'}
          </span>
        </div>

        <form onSubmit={onAnalyze} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Symptom input</label>
            <div className="flex gap-2">
              <input
                value={symptomInput}
                onChange={(event) => setSymptomInput(event.target.value)}
                placeholder="Type symptom and press Add (e.g., fever)"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
              <Button type="button" onClick={onAddSymptomFromInput} className="rounded-xl whitespace-nowrap">
                Add
              </Button>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Quick symptoms</p>
            <div className="flex flex-wrap gap-2">
              {quickSymptoms.map((item) => {
                const selected = symptoms.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => (selected ? removeSymptom(item) : addSymptom(item))}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      selected
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-700'
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Selected symptoms ({symptoms.length})</p>
            {symptoms.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                No symptoms selected yet.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {symptoms.map((item) => (
                  <span key={item} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-200">
                    {item}
                    <button type="button" onClick={() => removeSymptom(item)} className="text-indigo-500 hover:text-indigo-800">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Additional notes (optional)</label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              placeholder="Duration, severity, and anything you feel important"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <input type="checkbox" checked={useAI} onChange={(event) => setUseAI(event.target.checked)} />
            <span className="text-sm text-slate-700 font-medium">Use AI API (fallback to rule-based if AI service is unavailable)</span>
          </label>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-sm flex items-start gap-2">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={loading} className="rounded-xl">
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {loading ? 'Analyzing...' : 'Analyze Symptoms'}
            </Button>
            <Button type="button" variant="secondary" className="rounded-xl" onClick={navigateToRelevantDoctors}>
              <Stethoscope size={18} /> Find Doctors
            </Button>
          </div>
        </form>
      </Card>

      <div className="space-y-6">
        <Card className="rounded-3xl border-slate-200/80 shadow-sm bg-white/92 backdrop-blur-sm">
          <h2 className="text-lg font-bold text-slate-900">Analysis Result</h2>
          {!result ? (
            <p className="text-sm text-slate-500 mt-3">No analysis yet. Submit symptoms to view diagnosis suggestions.</p>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Method: {result.analysisMethod || 'unknown'}
              </div>
              {analysisItems.length === 0 ? (
                <p className="text-sm text-slate-600">No condition mapping found for the selected symptoms.</p>
              ) : (
                analysisItems.map((item, index) => (
                  <div key={`${item.id || item.source || 'result'}-${index}`} className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                    <p className="text-xs text-indigo-700 font-semibold">Match Score: {formatPercent(item.matchScore)}</p>
                    {item.severity && <p className="text-xs text-slate-500 mt-1">Severity: {item.severity}</p>}

                    <div className="mt-3">
                      <p className="text-sm font-semibold text-slate-700">Possible diagnosis suggestions</p>
                      <ul className="mt-1 text-sm text-slate-600 list-disc list-inside">
                        {(item.possibleConditions || []).map((condition) => (
                          <li key={condition}>{condition}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-3">
                      <p className="text-sm font-semibold text-slate-700">Recommended doctors</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(item.recommendedDoctors || []).map((doctor) => (
                          <span key={doctor} className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700">
                            {doctor}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}

              {result.disclaimer && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 p-3 text-xs leading-relaxed">
                  {result.disclaimer}
                </div>
              )}
            </div>
          )}
        </Card>

        <Card className="rounded-3xl border-slate-200/80 shadow-sm bg-white/92 backdrop-blur-sm">
          <h2 className="text-lg font-bold text-slate-900">Recent checks</h2>
          {historyLoading ? (
            <div className="text-sm text-slate-500 mt-3">Loading history...</div>
          ) : history.length === 0 ? (
            <p className="text-sm text-slate-500 mt-3">No history available yet.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {history.map((item) => {
                const firstResult = Array.isArray(item.results) ? item.results[0] : null;
                const topCondition = firstResult?.possibleConditions?.[0] || 'N/A';

                return (
                  <div key={item._id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">{formatDateTime(item.createdAt)}</p>
                    <p className="text-sm font-semibold text-slate-800 mt-1">Top suggestion: {topCondition}</p>
                    <p className="text-xs text-slate-600 mt-1">Symptoms: {(item.userSymptoms || []).join(', ')}</p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
      </div>
    </div>
  );
}
