import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGODB_URL = process.env.MONGODB_URL;
const APPOINTMENT_DB_NAME = process.env.APPOINTMENT_DB_NAME || 'appointments';

async function debug() {
  try {
    console.log('--- MediLink Extended Diagnostic ---');
    await mongoose.connect(MONGODB_URL);
    console.log('Connected to MongoDB');

    // 1. Check Doctors
    const doctors = await mongoose.connection.db.collection('doctors').find({}).project({name: 1, email: 1}).toArray();
    console.log('\n--- Doctors in Database ---');
    doctors.forEach(d => console.log(` - ID: ${d._id}, Name: ${d.name}, Email: ${d.email}`));

    // 2. Check Appointments
    const appointmentDb = mongoose.connection.useDb(APPOINTMENT_DB_NAME);
    const appointments = await appointmentDb.collection('appointments').find({}).toArray();
    
    console.log(`\n--- Appointments in ${APPOINTMENT_DB_NAME} ---`);
    if (appointments.length === 0) {
      console.log(' No appointments found.');
    } else {
      appointments.forEach(a => {
        console.log(` - ID: ${a._id}, DoctorID: ${a.doctorId}, Status: ${a.status}, Date: ${a.slotDate}`);
      });
    }

    process.exit(0);
  } catch (err) {
    console.error('\nDIAGNOSTIC FAILED:', err.message);
    process.exit(1);
  }
}

debug();
