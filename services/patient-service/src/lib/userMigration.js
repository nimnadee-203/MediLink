import mongoose from 'mongoose';
import Patient from '../models/Patient.js';
import Admin from '../models/Admin.js';

const normalizeEmail = (value = '') => String(value).trim().toLowerCase();

const parseAdminEmails = () =>
  Array.from(
    new Set(
      [
        ...(process.env.ADMIN_EMAILS || '').split(','),
        process.env.ADMIN_EMAIL,
        'admin@medisync.ai',
        'it23589254@my.sliit.lk'
      ]
        .map((email) => normalizeEmail(email))
        .filter(Boolean)
    )
  );

const readLegacyUsersFromDb = async (dbName, collectionName) => {
  const db = mongoose.connection.useDb(dbName, { useCache: true });
  const collections = await db.db.listCollections({ name: collectionName }).toArray();
  if (!collections.length) {
    return [];
  }

  const rows = await db.collection(collectionName).find({}).toArray();
  return rows.map((row) => ({ ...row, __sourceDb: dbName, __sourceCollection: collectionName }));
};

const buildWritablePayload = (legacyUser, roleOverride) => ({
  name: legacyUser.name || legacyUser.username || legacyUser.email || 'Migrated User',
  username: legacyUser.username,
  email: normalizeEmail(legacyUser.email),
  password: legacyUser.password,
  clerkUserId: legacyUser.clerkUserId,
  role: roleOverride,
  phone: legacyUser.phone,
  age: legacyUser.age,
  gender: legacyUser.gender,
  address: legacyUser.address,
  reports: Array.isArray(legacyUser.reports) ? legacyUser.reports : []
});

const upsertDomainUser = async (legacyUser, adminEmails) => {
  const email = normalizeEmail(legacyUser.email);
  if (!email) {
    return { action: 'skipped', reason: 'missing-email' };
  }

  const roleFromRow = String(legacyUser.role || '').trim().toLowerCase();
  const targetRole = roleFromRow === 'admin' || adminEmails.includes(email) ? 'admin' : 'patient';
  const payload = buildWritablePayload(legacyUser, targetRole);

  const [existingAdmin, existingPatient] = await Promise.all([
    Admin.findOne({ $or: [{ email }, ...(payload.clerkUserId ? [{ clerkUserId: payload.clerkUserId }] : [])] }),
    Patient.findOne({ $or: [{ email }, ...(payload.clerkUserId ? [{ clerkUserId: payload.clerkUserId }] : [])] })
  ]);

  if (targetRole === 'admin') {
    if (existingAdmin) {
      return { action: 'exists', target: 'admin' };
    }

    if (existingPatient) {
      const patientPayload = {
        name: existingPatient.name,
        username: existingPatient.username,
        email: existingPatient.email,
        password: existingPatient.password,
        clerkUserId: existingPatient.clerkUserId,
        role: 'admin',
        phone: existingPatient.phone,
        age: existingPatient.age,
        gender: existingPatient.gender,
        address: existingPatient.address,
        reports: existingPatient.reports || []
      };
      await Admin.create(patientPayload);
      await existingPatient.deleteOne();
      return { action: 'moved', target: 'admin' };
    }

    await Admin.create(payload);
    return { action: 'created', target: 'admin' };
  }

  if (existingPatient) {
    return { action: 'exists', target: 'patient' };
  }

  if (existingAdmin) {
    return { action: 'exists', target: 'admin' };
  }

  await Patient.create(payload);
  return { action: 'created', target: 'patient' };
};

export const migrateLegacyUsersToDomainCollections = async () => {
  const patientDbName = process.env.PATIENT_DB_NAME || 'patients';
  const adminDbName = process.env.ADMIN_DB_NAME || 'admin_1';
  const legacyCollectionNames = (process.env.LEGACY_USERS_COLLECTION_NAMES || process.env.LEGACY_USERS_COLLECTION_NAME || 'users,patients')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const legacySourceDbs = (process.env.LEGACY_SOURCE_DB_NAMES || process.env.LEGACY_TEST_DB_NAMES || 'test,medilink,test-patient,test-patiend')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const dbCandidates = Array.from(new Set([...legacySourceDbs, patientDbName, adminDbName]));
  const adminEmails = parseAdminEmails();

  const summary = {
    scanned: 0,
    createdPatients: 0,
    createdAdmins: 0,
    movedToAdmin: 0,
    alreadyExists: 0,
    skipped: 0,
    sourceDbs: dbCandidates
  };

  for (const dbName of dbCandidates) {
    for (const collectionName of legacyCollectionNames) {
      const legacyRows = await readLegacyUsersFromDb(dbName, collectionName);

      for (const row of legacyRows) {
        summary.scanned += 1;
        const result = await upsertDomainUser(row, adminEmails);

        if (result.action === 'created' && result.target === 'patient') summary.createdPatients += 1;
        if (result.action === 'created' && result.target === 'admin') summary.createdAdmins += 1;
        if (result.action === 'moved' && result.target === 'admin') summary.movedToAdmin += 1;
        if (result.action === 'exists') summary.alreadyExists += 1;
        if (result.action === 'skipped') summary.skipped += 1;
      }
    }
  }

  return summary;
};

export const dropLegacyTestDatabases = async () => {
  const protectedDbs = new Set([
    process.env.PATIENT_DB_NAME || 'patients',
    process.env.ADMIN_DB_NAME || 'admin_1',
    'auth',
    'appointments',
    'doctors'
  ]);

  const candidates = (process.env.LEGACY_TEST_DB_NAMES || 'test,test-patient,test-patiend')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((name) => !protectedDbs.has(name));

  const dropped = [];
  const missing = [];

  for (const dbName of candidates) {
    const db = mongoose.connection.useDb(dbName, { useCache: true });
    const collections = await db.db.listCollections().toArray();

    if (!collections.length) {
      missing.push(dbName);
      continue;
    }

    await db.dropDatabase();
    dropped.push(dbName);
  }

  return { dropped, missing };
};
