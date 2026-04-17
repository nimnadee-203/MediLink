import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URL);

  const patientDbName = process.env.PATIENT_DB_NAME || 'patients';
  const adminDbName = process.env.ADMIN_DB_NAME || 'admins';
  const patientCollectionName = process.env.PATIENT_COLLECTION_NAME || 'patients';
  const adminCollectionName = process.env.ADMIN_COLLECTION_NAME || 'admins';

  const patientDb = mongoose.connection.useDb(patientDbName, { useCache: true });
  const adminDb = mongoose.connection.useDb(adminDbName, { useCache: true });

  const [patientsCount, admins] = await Promise.all([
    patientDb.collection(patientCollectionName).countDocuments(),
    adminDb.collection(adminCollectionName).find({}, { projection: { email: 1, role: 1 } }).toArray()
  ]);

  console.log('Patient DB:', patientDbName);
  console.log('Patient Collection:', patientCollectionName);
  console.log('Patient Count:', patientsCount);
  console.log('Admin DB:', adminDbName);
  console.log('Admin Collection:', adminCollectionName);
  console.log('Admin Count:', admins.length);
  console.log('Admin Emails:', admins.map((item) => item.email));

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error('Domain data check failed:', error.message);
  await mongoose.disconnect();
  process.exit(1);
});
