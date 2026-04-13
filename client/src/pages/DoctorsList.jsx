import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, MapPin, Clock, Star, Stethoscope } from 'lucide-react';
import { cn, Card, Button } from '../components/ui';
import { mockDoctors, SPECIALITIES } from '../data/mockDoctors';

export default function DoctorsList() {
  const [searchParams] = useSearchParams();
  const [selectedSpeciality, setSelectedSpeciality] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setSearchQuery(searchParams.get('q') ?? '');
    setSelectedSpeciality(searchParams.get('speciality') ?? '');
  }, [searchParams]);

  const filteredDoctors = mockDoctors.filter((doc) => {
    if (!doc.available) return false;
    if (selectedSpeciality && doc.speciality !== selectedSpeciality) return false;
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
          <option value="">All Specialities</option>
          {SPECIALITIES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {filteredDoctors.length === 0 ? (
        <Card className="text-center py-16">
          <Stethoscope className="mx-auto text-gray-300 mb-4" size={56} />
          <p className="text-gray-500 text-lg font-medium">No doctors found matching your criteria.</p>
          <p className="text-gray-400 mt-1">Try adjusting your filters.</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDoctors.map((doctor) => (
            <Card key={doctor._id} className="p-0 overflow-hidden hover:shadow-2xl transition-shadow duration-300">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 flex items-center gap-4">
                <img
                  src={doctor.image}
                  alt={doctor.name}
                  className="w-16 h-16 rounded-full border-2 border-white/30 object-cover"
                />
                <div className="min-w-0">
                  <h3 className="text-white font-bold text-lg truncate">{doctor.name}</h3>
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
          ))}
        </div>
      )}
    </div>
  );
}
