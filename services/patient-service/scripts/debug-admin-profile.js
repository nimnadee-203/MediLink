import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const email = (process.argv[2] || '').trim().toLowerCase();
if (!email) {
  console.error('Usage: node scripts/debug-admin-profile.js <email>');
  process.exit(1);
}

const uri = process.env.MONGO_URI || process.env.MONGODB_URL;
if (!uri) {
  console.error('Missing MONGO_URI / MONGODB_URL');
  process.exit(1);
}

const adminDbName = process.env.ADMIN_DB_NAME || 'admin_1';
const patientDbName = process.env.PATIENT_DB_NAME || 'patients';
const adminCollection = process.env.ADMIN_COLLECTION_NAME || 'admin';
const patientCollection = process.env.PATIENT_COLLECTION_NAME || 'patients';

await mongoose.connect(uri);

const adminDb = mongoose.connection.useDb(adminDbName, { useCache: true });
const patientDb = mongoose.connection.useDb(patientDbName, { useCache: true });

const admins = await adminDb
  .collection(adminCollection)
  .find({ email })
  .project({ name: 1, email: 1, phone: 1, age: 1, gender: 1, address: 1, clerkUserId: 1, role: 1, updatedAt: 1 })
  .toArray();

const patients = await patientDb
  .collection(patientCollection)
  .find({ email })
  .project({ name: 1, email: 1, phone: 1, age: 1, gender: 1, address: 1, clerkUserId: 1, role: 1, updatedAt: 1 })
  .toArray();

console.log(
  JSON.stringify(
    {
      email,
      adminDbName,
      patientDbName,
      adminCollection,
      patientCollection,
      adminCount: admins.length,
      patientCount: patients.length,
      admins,
      patients
    },
    null,
    2
  )
);

await mongoose.disconnect();
