export const SPECIALITIES = [
  'General Physician',
  'Cardiologist',
  'Dermatologist',
  'Pediatrician',
  'Neurologist',
  'Orthopedic',
  'Gynecologist',
  'ENT Specialist'
];

export const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00'
];

export const CONSULTATION_MODE_LABELS = {
  in_person_only: 'In-person only',
  both: 'In-person + Telemedicine'
};

export const mockDoctors = [
  {
    _id: '665f1a2b3c4d5e6f7a8b9c01',
    name: 'Dr. Sarah Johnson',
    speciality: 'Cardiologist',
    degree: 'MBBS, MD (Cardiology)',
    experience: '10 years',
    fees: 2500,
    available: true,
    consultationMode: 'both',
    image: 'https://ui-avatars.com/api/?name=Sarah+Johnson&background=3b82f6&color=fff&size=200&bold=true',
    about: 'Experienced cardiologist specializing in heart disease prevention and treatment of cardiovascular conditions.',
    address: 'Colombo 07',
    slots_booked: {}
  },
  {
    _id: '665f1a2b3c4d5e6f7a8b9c02',
    name: 'Dr. Amal Perera',
    speciality: 'General Physician',
    degree: 'MBBS, MD',
    experience: '8 years',
    fees: 1500,
    available: true,
    consultationMode: 'in_person_only',
    image: 'https://ui-avatars.com/api/?name=Amal+Perera&background=10b981&color=fff&size=200&bold=true',
    about: 'Dedicated general physician providing comprehensive primary care services for all age groups.',
    address: 'Kandy',
    slots_booked: {}
  },
  {
    _id: '665f1a2b3c4d5e6f7a8b9c03',
    name: 'Dr. Nisha Fernando',
    speciality: 'Dermatologist',
    degree: 'MBBS, MD (Dermatology)',
    experience: '12 years',
    fees: 3000,
    available: true,
    consultationMode: 'both',
    image: 'https://ui-avatars.com/api/?name=Nisha+Fernando&background=8b5cf6&color=fff&size=200&bold=true',
    about: 'Specialist in skin disorders, cosmetic dermatology, and advanced skin treatments.',
    address: 'Colombo 03',
    slots_booked: {}
  },
  {
    _id: '665f1a2b3c4d5e6f7a8b9c04',
    name: 'Dr. Kavindu Silva',
    speciality: 'Orthopedic',
    degree: 'MBBS, MS (Ortho)',
    experience: '15 years',
    fees: 3500,
    available: true,
    consultationMode: 'in_person_only',
    image: 'https://ui-avatars.com/api/?name=Kavindu+Silva&background=f59e0b&color=fff&size=200&bold=true',
    about: 'Expert orthopedic surgeon specializing in joint replacements and sports injuries.',
    address: 'Galle',
    slots_booked: {}
  },
  {
    _id: '665f1a2b3c4d5e6f7a8b9c05',
    name: 'Dr. Rashmi Dias',
    speciality: 'Pediatrician',
    degree: 'MBBS, DCH',
    experience: '9 years',
    fees: 2000,
    available: true,
    consultationMode: 'both',
    image: 'https://ui-avatars.com/api/?name=Rashmi+Dias&background=ec4899&color=fff&size=200&bold=true',
    about: 'Compassionate pediatrician dedicated to child healthcare and developmental assessments.',
    address: 'Colombo 05',
    slots_booked: {}
  },
  {
    _id: '665f1a2b3c4d5e6f7a8b9c06',
    name: 'Dr. Tharindu Bandara',
    speciality: 'Neurologist',
    degree: 'MBBS, MD (Neurology)',
    experience: '14 years',
    fees: 4000,
    available: true,
    consultationMode: 'both',
    image: 'https://ui-avatars.com/api/?name=Tharindu+Bandara&background=6366f1&color=fff&size=200&bold=true',
    about: 'Leading neurologist specializing in brain and nervous system disorders.',
    address: 'Colombo 08',
    slots_booked: {}
  },
  {
    _id: '665f1a2b3c4d5e6f7a8b9c07',
    name: 'Dr. Chamari Jayawardena',
    speciality: 'Gynecologist',
    degree: 'MBBS, MD (Obs & Gyn)',
    experience: '11 years',
    fees: 3000,
    available: true,
    consultationMode: 'both',
    image: 'https://ui-avatars.com/api/?name=Chamari+J&background=14b8a6&color=fff&size=200&bold=true',
    about: 'Experienced gynecologist providing comprehensive women\'s healthcare and obstetric services.',
    address: 'Negombo',
    slots_booked: {}
  },
  {
    _id: '665f1a2b3c4d5e6f7a8b9c08',
    name: 'Dr. Ruwan Wickramasinghe',
    speciality: 'ENT Specialist',
    degree: 'MBBS, MS (ENT)',
    experience: '7 years',
    fees: 2500,
    available: true,
    consultationMode: 'in_person_only',
    image: 'https://ui-avatars.com/api/?name=Ruwan+W&background=f97316&color=fff&size=200&bold=true',
    about: 'ENT specialist treating conditions related to ear, nose, throat, head, and neck.',
    address: 'Matara',
    slots_booked: {}
  }
];
