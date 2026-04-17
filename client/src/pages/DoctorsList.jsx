import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, MapPin, Clock, Star, Stethoscope, Video } from 'lucide-react';
import { cn, Card, Button } from '../components/ui';
import { CONSULTATION_MODE_LABELS, fetchDoctors, formatDoctorDisplayName } from '../lib/doctors';

const RECOMMENDED_SPECIALITY_VALUE = '__recommended__';

export default function DoctorsList() {
  const [searchParams] = useSearchParams();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSpeciality, setSelectedSpeciality] = useState('');
  const [recommendedSpecialities, setRecommendedSpecialities] = useState([]);
  const [selectedConsultationMode, setSelectedConsultationMode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setSearchQuery(searchParams.get('q') ?? '');
    const specialityFromQuery = searchParams.get('speciality') ?? '';
    const rawRecommended = searchParams.get('specialities') ?? '';
    const parsedRecommended = rawRecommended
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    setRecommendedSpecialities(parsedRecommended);
    setSelectedSpeciality(
      specialityFromQuery || (parsedRecommended.length > 0 ? RECOMMENDED_SPECIALITY_VALUE : '')
    );
    setSelectedConsultationMode(searchParams.get('consultationMode') ?? '');
  }, [searchParams]);

  useEffect(() => {
    let active = true;

    const loadDoctors = async () => {
      try {
        setLoading(true);
        setError('');
        const list = await fetchDoctors();
        if (active) {
          setDoctors(list);
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Failed to load doctors');
          setDoctors([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadDoctors();
    return () => {
      active = false;
    };
  }, []);

  const specialities = [...new Set(doctors.map((doc) => doc.speciality).filter(Boolean))].sort();

  const filteredDoctors = doctors.filter((doc) => {
    if (!doc.available) return false;
    if (
      selectedSpeciality &&
      selectedSpeciality !== RECOMMENDED_SPECIALITY_VALUE &&
      doc.speciality !== selectedSpeciality
    ) {
      return false;
    }
    if (selectedSpeciality === RECOMMENDED_SPECIALITY_VALUE) {
      if (recommendedSpecialities.length > 0 && !recommendedSpecialities.includes(doc.speciality)) return false;
    }
    if (selectedConsultationMode === 'telemedicine' && doc.consultationMode !== 'both') return false;
    if (selectedConsultationMode === 'in_person_only' && doc.consultationMode !== 'in_person_only') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        doc.name.toLowerCase().includes(q) ||
        doc.speciality.toLowerCase().includes(q) ||
        doc.address.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Find a Doctor</h2>
        <p className="text-gray-500 text-lg mt-1">Book an appointment with top specialists</p>
        {recommendedSpecialities.length > 0 && selectedSpeciality === RECOMMENDED_SPECIALITY_VALUE && (
          <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm text-indigo-800">
            Showing doctors relevant to your symptom check: {recommendedSpecialities.join(', ')}
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <Search size={20} />
          </div>
          <input
            type="text"
            placeholder="Search by name, speciality, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-gray-900 focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all outline-none shadow-sm"
          />
        </div>

        <select
          value={selectedSpeciality}
          onChange={(e) => setSelectedSpeciality(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white py-3 px-4 text-gray-900 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none shadow-sm min-w-[200px]"
        >
          {recommendedSpecialities.length > 0 && (
            <option value={RECOMMENDED_SPECIALITY_VALUE}>
              Recommended ({recommendedSpecialities.join(', ')})
            </option>
          )}
          <option value="">All Specialities</option>
          {specialities.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={selectedConsultationMode}
          onChange={(e) => setSelectedConsultationMode(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white py-3 px-4 text-gray-900 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none shadow-sm min-w-[220px]"
        >
          <option value="">All Consultation Types</option>
          <option value="telemedicine">Telemedicine Available</option>
          <option value="in_person_only">In-person Only</option>
        </select>
      </div>

      {loading && (
        <Card className="text-center py-16">
          <p className="text-gray-500 text-lg font-medium">Loading doctors...</p>
        </Card>
      )}

      {!loading && error && (
        <Card className="text-center py-16">
          <Stethoscope className="mx-auto text-red-300 mb-4" size={56} />
          <p className="text-red-500 text-lg font-medium">{error}</p>
        </Card>
      )}

      {!loading && !error && filteredDoctors.length === 0 ? (
        <Card className="text-center py-16">
          <Stethoscope className="mx-auto text-gray-300 mb-4" size={56} />
          <p className="text-gray-500 text-lg font-medium">No doctors found matching your criteria.</p>
          <p className="text-gray-400 mt-1">Try adjusting your filters.</p>
        </Card>
      ) : !loading && !error ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDoctors.map((doctor) => {
            const displayDoctorName = formatDoctorDisplayName(doctor.name);
            return (
              <Card key={doctor._id} className="p-0 overflow-hidden hover:shadow-2xl transition-shadow duration-300">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 flex items-center gap-4">
                <img
                  src={doctor.image}
                  alt={displayDoctorName}
                  className="w-16 h-16 rounded-full border-2 border-white/30 object-cover"
                />
                <div className="min-w-0">
                  <h3 className="text-white font-bold text-lg truncate">{displayDoctorName}</h3>
                  <p className="text-blue-100 text-sm">{doctor.speciality}</p>
                </div>
              </div>

              <div className="p-6 space-y-3">
                <p className="text-sm text-gray-600 line-clamp-2">{doctor.about}</p>

                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock size={14} />
                  <span>{doctor.experience} experience</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <MapPin size={14} />
                  <span>{doctor.address}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Star size={14} className="text-amber-400 fill-amber-400" />
                  <span>{doctor.degree}</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 text-sky-700 px-3 py-1 text-xs font-semibold border border-sky-100">
                  <Video size={12} />
                  {CONSULTATION_MODE_LABELS[doctor.consultationMode] || CONSULTATION_MODE_LABELS.in_person_only}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div>
                    <span className="text-2xl font-bold text-gray-900">Rs. {doctor.fees.toLocaleString()}</span>
                    <span className="text-gray-400 text-sm"> /visit</span>
                  </div>
                </div>

                <Link to={`/book/${doctor._id}`}>
                  <Button className="w-full mt-2 text-sm py-2.5">
                    Book Appointment
                  </Button>
                </Link>
              </div>
            </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
