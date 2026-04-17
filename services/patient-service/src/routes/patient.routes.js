import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { createClerkClient } from '@clerk/backend';
import Patient from '../models/Patient.js';
import Admin from '../models/Admin.js';
import Report from '../models/Report.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  listNotificationsForRecipient,
  markNotificationReadInternal
} from '../lib/notificationClient.js';
import {
  migrateLegacyUsersToDomainCollections,
  dropLegacyTestDatabases
} from '../lib/userMigration.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const reportsDir = path.join(__dirname, '..', 'uploads', 'reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, reportsDir),
  filename: (_req, file, cb) => {
    const safeOriginalName = file.originalname.replace(/\s+/g, '_');
    cb(null, `${Date.now()}-${safeOriginalName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

const USER_ROLES = ['patient', 'doctor', 'admin'];

const normalizeEmail = (value = '') => String(value).trim().toLowerCase();

const parseAdminEmails = () =>
  Array.from(
    new Set(
      [
        ...(process.env.ADMIN_EMAILS || '').split(','),
        'admin@medisync.ai',
        'it23589254@my.sliit.lk'
      ]
        .map((email) => normalizeEmail(email))
        .filter(Boolean)
    )
  );

const isAdminEmail = (email) => {
  if (!email) return false;
  return parseAdminEmails().includes(normalizeEmail(email));
};

const parseAdminClerkUserIds = () =>
  (process.env.ADMIN_CLERK_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

const isAdminClerkUserId = (clerkUserId) => {
  if (!clerkUserId) return false;
  return parseAdminClerkUserIds().includes(clerkUserId);
};

const getClerkClient = () => {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey || /replace_with/i.test(secretKey)) {
    return null;
  }

  return createClerkClient({ secretKey });
};

const splitName = (fullName = '') => {
  const normalized = fullName.trim().replace(/\s+/g, ' ');
  if (!normalized) return { firstName: undefined, lastName: undefined };

  const [firstName, ...rest] = normalized.split(' ');
  return {
    firstName,
    lastName: rest.length ? rest.join(' ') : undefined
  };
};

const randomSuffix = () => Math.random().toString(36).slice(2, 6);

const normalizeClerkUsername = (value = '') => {
  let username = String(value).trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');

  if (!username) {
    return `user_${randomSuffix()}`;
  }

  if (!/^[a-z]/.test(username)) {
    username = `u${username}`;
  }

  if (username.length < 3) {
    username = `${username}${randomSuffix()}`;
  }

  return username.slice(0, 32);
};

const extractClerkErrorText = (error) =>
  error?.errors?.map((item) => `${item?.code || ''}:${item?.longMessage || item?.message || ''}`).join(' | ') || error?.message || '';

const hasUsernameRequirementError = (error) => /username/i.test(extractClerkErrorText(error));

const createClerkUserWithUsernameFallback = async ({ clerkClient, email, password, firstName, lastName, role, username }) => {
  const primary = normalizeClerkUsername(username);
  const alnumOnly = primary.replace(/[^a-z0-9]/g, '').slice(0, 24) || `user${randomSuffix()}`;
  const candidates = Array.from(new Set([
    primary,
    alnumOnly,
    `${primary.slice(0, 26)}_${randomSuffix()}`,
    `user_${randomSuffix()}${randomSuffix()}`
  ]));

  let lastError;

  for (const candidate of candidates) {
    try {
      const created = await clerkClient.users.createUser({
        username: candidate,
        emailAddress: [email],
        password: String(password),
        firstName,
        lastName,
        publicMetadata: { role }
      });

      return created;
    } catch (error) {
      lastError = error;
      if (!hasUsernameRequirementError(error)) {
        throw error;
      }
    }
  }

  try {
    const createdWithoutUsername = await clerkClient.users.createUser({
      emailAddress: [email],
      password: String(password),
      firstName,
      lastName,
      publicMetadata: { role }
    });

    return createdWithoutUsername;
  } catch (error) {
    if (!hasUsernameRequirementError(error)) {
      throw error;
    }
    lastError = error;
  }

  throw lastError;
};

const sanitizeUser = (user, source = 'patient-db') => ({
  id: user._id,
  name: user.name,
  username: user.username,
  email: user.email,
  role: user.role || (source === 'admin-db' ? 'admin' : 'patient'),
  phone: user.phone,
  age: user.age,
  gender: user.gender,
  address: user.address,
  clerkUserId: user.clerkUserId,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  source
});

const toWritablePayload = (user) => ({
  name: user.name,
  username: user.username,
  email: user.email,
  password: user.password,
  clerkUserId: user.clerkUserId,
  role: user.role,
  phone: user.phone,
  age: user.age,
  gender: user.gender,
  address: user.address,
  reports: user.reports || []
});

const normalizeInputRole = (role) => {
  if (role === 'admin') return 'admin';
  if (role === 'doctor') return 'doctor';
  return 'patient';
};

const getProfileHints = (req) => ({
  email: req.headers['x-clerk-email'] || '',
  name: req.headers['x-clerk-name'] || '',
  phone: req.headers['x-clerk-phone'] || ''
});

const findUserByIdentity = async (user, profileHints = {}) => {
  const emailCandidates = [
    normalizeEmail(user?.email),
    normalizeEmail(profileHints?.email)
  ].filter(Boolean);

  const orConditions = [];
  if (user?.id) {
    orConditions.push({ clerkUserId: user.id });
  }
  emailCandidates.forEach((email) => {
    orConditions.push({ email });
  });

  if (!orConditions.length) {
    return { adminUser: null, patientUser: null };
  }

  const [adminUser, patientUser] = await Promise.all([
    Admin.findOne({ $or: orConditions }),
    Patient.findOne({ $or: orConditions })
  ]);

  return { adminUser, patientUser };
};

const findUserByIdAcrossStores = async (userId) => {
  const [adminUser, patientUser] = await Promise.all([
    Admin.findById(userId),
    Patient.findById(userId)
  ]);

  if (adminUser) {
    return { user: adminUser, source: 'admin-db' };
  }

  if (patientUser) {
    return { user: patientUser, source: 'patient-db' };
  }

  return { user: null, source: null };
};

const syncClerkMetadata = async (clerkUserId, role, name) => {
  if (!clerkUserId) return;

  const clerkClient = getClerkClient();
  if (!clerkClient) return;

  if (role) {
    await clerkClient.users.updateUserMetadata(clerkUserId, {
      publicMetadata: { role }
    });
  }

  if (name !== undefined) {
    const { firstName, lastName } = splitName(name || '');
    await clerkClient.users.updateUser(clerkUserId, {
      firstName,
      lastName
    });
  }
};

const migrateLegacyAdminUsers = async () => {
  const legacyAdmins = await Patient.find({ role: 'admin' });
  if (!legacyAdmins.length) return;

  for (const legacyAdmin of legacyAdmins) {
    const existsInAdminDb = await Admin.findOne({
      $or: [
        { email: legacyAdmin.email },
        ...(legacyAdmin.clerkUserId ? [{ clerkUserId: legacyAdmin.clerkUserId }] : [])
      ]
    });

    if (!existsInAdminDb) {
      const payload = toWritablePayload(legacyAdmin.toObject());
      payload.role = 'admin';
      await Admin.create(payload);
    }

    await legacyAdmin.deleteOne();
  }
};

const ensureConfiguredAdminAccounts = async () => {
  const adminEmails = parseAdminEmails();
  if (!adminEmails.length) return;

  for (const email of adminEmails) {
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      if (existingAdmin.role !== 'admin') {
        existingAdmin.role = 'admin';
        await existingAdmin.save();
      }
      continue;
    }

    const existingPatient = await Patient.findOne({ email });
    if (existingPatient) {
      const payload = toWritablePayload(existingPatient.toObject());
      payload.role = 'admin';
      try {
        await Admin.create(payload);
      } catch (error) {
        if (error?.code !== 11000) {
          throw error;
        }
      }
      await existingPatient.deleteOne();
      continue;
    }

    try {
      await Admin.create({
        name: email.split('@')[0] || 'Admin User',
        email,
        role: 'admin'
      });
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }
    }
  }
};

const resolveCurrentPatient = async (user, profileHints = {}) => {
  const { adminUser, patientUser } = await findUserByIdentity(user, profileHints);
  const hintedEmail = normalizeEmail(profileHints?.email);
  const hintedName = typeof profileHints?.name === 'string' ? profileHints.name.trim() : '';
  const hintedPhone = typeof profileHints?.phone === 'string' ? profileHints.phone.trim() : '';
  const claimedRole = normalizeInputRole(user?.role);

  const preferredEmail = normalizeEmail(user?.email) || hintedEmail || `${user?.id || 'anonymous'}@clerk.local`;
  const shouldBeAdmin =
    user?.forceAdmin === true ||
    user?.authType === 'admin' ||
    user?.role === 'admin' ||
    Boolean(adminUser) ||
    isAdminEmail(preferredEmail) ||
    isAdminClerkUserId(user?.id) ||
    isAdminClerkUserId(adminUser?.clerkUserId) ||
    isAdminClerkUserId(patientUser?.clerkUserId);

  if (shouldBeAdmin) {
    const sourceUser = adminUser || patientUser;
    const adminPayload = {
      ...(sourceUser ? toWritablePayload(sourceUser.toObject()) : {}),
      name: hintedName || sourceUser?.name || user.name || user.email || user.phone || 'Clerk User',
      email: preferredEmail,
      clerkUserId: user?.id,
      role: 'admin',
      phone: hintedPhone || sourceUser?.phone || user.phone || undefined
    };

    let ensuredAdmin = adminUser;
    if (ensuredAdmin) {
      Object.assign(ensuredAdmin, adminPayload);
      await ensuredAdmin.save();
    } else {
      try {
        ensuredAdmin = await Admin.create(adminPayload);
      } catch (error) {
        if (error?.code !== 11000) {
          throw error;
        }

        ensuredAdmin = await Admin.findOne({
          $or: [
            { email: adminPayload.email },
            ...(adminPayload.clerkUserId ? [{ clerkUserId: adminPayload.clerkUserId }] : [])
          ]
        });

        if (!ensuredAdmin) {
          throw error;
        }

        Object.assign(ensuredAdmin, adminPayload);
        await ensuredAdmin.save();
      }
    }

    if (patientUser) {
      await patientUser.deleteOne();
    }

    return ensuredAdmin;
  }

  if (patientUser) {
    let shouldSave = false;

    if (!patientUser.clerkUserId && user?.id) {
      patientUser.clerkUserId = user.id;
      shouldSave = true;
    }

    if (patientUser.role === 'admin') {
      patientUser.role = 'patient';
      shouldSave = true;
    }

    if (claimedRole === 'doctor' && patientUser.role !== 'doctor') {
      patientUser.role = 'doctor';
      shouldSave = true;
    }

    const hasRealUserEmail = Boolean(user?.email && !user.email.endsWith('@clerk.local'));
    const hasPlaceholderPatientEmail = Boolean(patientUser.email && patientUser.email.endsWith('@clerk.local'));

    if (hasRealUserEmail && hasPlaceholderPatientEmail) {
      patientUser.email = normalizeEmail(user?.email);
      shouldSave = true;
    }

    const hasRealHintedEmail = Boolean(hintedEmail && !hintedEmail.endsWith('@clerk.local'));
    if (hasRealHintedEmail && hasPlaceholderPatientEmail) {
      patientUser.email = hintedEmail;
      shouldSave = true;
    }

    if (hintedName && (!patientUser.name || patientUser.name === 'Clerk User')) {
      patientUser.name = hintedName;
      shouldSave = true;
    }

    if (hintedPhone && !patientUser.phone) {
      patientUser.phone = hintedPhone;
      shouldSave = true;
    }

    if (shouldSave) {
      await patientUser.save();
    }

    return patientUser;
  }

  if (adminUser) {
    let shouldSave = false;

    if (!adminUser.clerkUserId && user?.id) {
      adminUser.clerkUserId = user.id;
      shouldSave = true;
    }

    if (adminUser.role !== 'admin') {
      adminUser.role = 'admin';
      shouldSave = true;
    }

    const hasRealUserEmail = Boolean(user?.email && !user.email.endsWith('@clerk.local'));
    const hasPlaceholderAdminEmail = Boolean(adminUser.email && adminUser.email.endsWith('@clerk.local'));

    if (hasRealUserEmail && hasPlaceholderAdminEmail) {
      adminUser.email = normalizeEmail(user?.email);
      shouldSave = true;
    }

    const hasRealHintedEmail = Boolean(hintedEmail && !hintedEmail.endsWith('@clerk.local'));
    if (hasRealHintedEmail && hasPlaceholderAdminEmail) {
      adminUser.email = hintedEmail;
      shouldSave = true;
    }

    if (hintedName && (!adminUser.name || adminUser.name === 'Clerk User')) {
      adminUser.name = hintedName;
      shouldSave = true;
    }

    if (hintedPhone && !adminUser.phone) {
      adminUser.phone = hintedPhone;
      shouldSave = true;
    }

    if (shouldSave) {
      await adminUser.save();
    }

    return adminUser;
  }

  const created = await Patient.create({
    name: user?.name || user?.email || user?.phone || 'Clerk User',
    email: preferredEmail,
    role: claimedRole === 'doctor' ? 'doctor' : 'patient',
    clerkUserId: user?.id,
    phone: user?.phone || undefined
  });

  return created;
};

const requireAdmin = async (req, res, next) => {
  try {
    const profileHints = getProfileHints(req);
    const hintedEmail = normalizeEmail(profileHints?.email || req.user?.email || '');

    const { adminUser, patientUser } = await findUserByIdentity(req.user, profileHints);

    if (adminUser && adminUser.role === 'admin') {
      req.currentUser = adminUser;
      return next();
    }

    if (patientUser && patientUser.role === 'admin') {
      req.currentUser = patientUser;
      return next();
    }

    const allowedByClaims =
      req.user?.forceAdmin === true ||
      req.user?.authType === 'admin' ||
      req.user?.role === 'admin' ||
      isAdminClerkUserId(req.user?.id) ||
      isAdminEmail(hintedEmail);

    if (!allowedByClaims) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    let ensuredAdmin = adminUser;

    if (!ensuredAdmin) {
      if (hintedEmail) {
        ensuredAdmin = await Admin.findOne({ email: hintedEmail });
      }

      if (!ensuredAdmin && req.user?.id) {
        ensuredAdmin = await Admin.findOne({ clerkUserId: req.user.id });
      }
    }

    if (!ensuredAdmin) {
      const candidateName = profileHints?.name?.trim() || req.user?.name || hintedEmail || 'Admin User';
      const candidateEmail = hintedEmail || `${req.user?.id || 'admin'}@clerk.local`;

      try {
        ensuredAdmin = await Admin.create({
          name: candidateName,
          email: candidateEmail,
          clerkUserId: req.user?.id,
          role: 'admin'
        });
      } catch (error) {
        if (error?.code === 11000) {
          ensuredAdmin = await Admin.findOne({
            $or: [
              { email: candidateEmail },
              ...(req.user?.id ? [{ clerkUserId: req.user.id }] : [])
            ]
          });
        } else {
          throw error;
        }
      }
    }

    if (!ensuredAdmin || ensuredAdmin.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    req.currentUser = ensuredAdmin;
    return next();
  } catch (error) {
    return res.status(500).json({ message: 'Failed to validate admin access', error: error.message });
  }
};

const migrateEmbeddedReportsForAccount = async (account) => {
  if (!account || account.role !== 'patient' || !Array.isArray(account.reports) || !account.reports.length) {
    return;
  }

  const operations = account.reports
    .filter((item) => item?._id && item?.fileName && item?.filePath)
    .map((item) => ({
      updateOne: {
        filter: {
          patientId: account._id,
          legacyReportId: String(item._id)
        },
        update: {
          $setOnInsert: {
            patientId: account._id,
            patientEmail: account.email,
            patientName: account.name,
            title: item.title,
            description: item.description,
            fileName: item.fileName,
            filePath: item.filePath,
            mimeType: item.mimeType,
            size: item.size,
            uploadedAt: item.uploadedAt || new Date(),
            legacyReportId: String(item._id)
          }
        },
        upsert: true
      }
    }));

  if (operations.length) {
    await Report.bulkWrite(operations, { ordered: false });
  }

  account.reports = [];
  await account.save();
};

const listReportsForAccount = async (account) => {
  await migrateEmbeddedReportsForAccount(account);
  return Report.find({ patientId: account._id }).sort({ uploadedAt: -1, _id: -1 });
};

router.post('/register', async (_req, res) => {
  return res.status(410).json({ message: 'This service uses Clerk authentication. Sign up from the client app.' });
});

router.post('/login', async (_req, res) => {
  return res.status(410).json({ message: 'This service uses Clerk authentication. Sign in from the client app.' });
});

router.get('/profile', authMiddleware, async (req, res) => {
  try {
    try {
      await ensureConfiguredAdminAccounts();
    } catch (bootstrapError) {
      console.warn('[patient-service] admin bootstrap warning:', bootstrapError.message);
    }

    const account = await resolveCurrentPatient(req.user, getProfileHints(req));
    if (!account) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    const source = account.role === 'admin' ? 'admin-db' : 'patient-db';
    return res.json({ patient: sanitizeUser(account, source) });
  } catch (error) {
    try {
      const hintedEmail = normalizeEmail(getProfileHints(req)?.email || req.user?.email || '');
      if (hintedEmail) {
        const fallbackAdmin = await Admin.findOne({ email: hintedEmail });
        if (fallbackAdmin) {
          return res.json({ patient: sanitizeUser(fallbackAdmin, 'admin-db') });
        }

        const fallbackPatient = await Patient.findOne({ email: hintedEmail });
        if (fallbackPatient) {
          return res.json({ patient: sanitizeUser(fallbackPatient, 'patient-db') });
        }
      }
    } catch {
    }

    return res.status(500).json({ message: 'Failed to fetch profile', error: error.message });
  }
});

router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const updates = (({ name, phone, age, gender, address }) => ({ name, phone, age, gender, address }))(req.body);
    const account = await resolveCurrentPatient(req.user, getProfileHints(req));

    if (!account) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        account[key] = value;
      }
    });

    await account.save();

    if (updates.name !== undefined) {
      await syncClerkMetadata(req.user.id, null, updates.name);
    }

    const source = account.role === 'admin' ? 'admin-db' : 'patient-db';
    return res.json({ message: 'Profile updated successfully', patient: sanitizeUser(account, source) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update profile', error: error.message });
  }
});

router.get('/admin/users', authMiddleware, requireAdmin, async (_req, res) => {
  try {
    await migrateLegacyAdminUsers();
    await ensureConfiguredAdminAccounts();

    const [patients, admins] = await Promise.all([
      Patient.find({ role: { $ne: 'admin' } }).sort({ createdAt: -1 }),
      Admin.find({}).sort({ createdAt: -1 })
    ]);

    const users = [
      ...patients.map((item) => sanitizeUser(item, 'patient-db')),
      ...admins.map((item) => sanitizeUser(item, 'admin-db'))
    ].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    return res.json({ users });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch users', error: error.message });
  }
});

router.post('/admin/users', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { name, username, email, role = 'patient', phone, password } = req.body;

    if (!name || !email || !username) {
      return res.status(400).json({ message: 'name, username and email are required' });
    }

    if (!password || String(password).length < 8) {
      return res.status(400).json({ message: 'password is required and must be at least 8 characters' });
    }

    if (!USER_ROLES.includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Allowed roles: patient, doctor, admin.' });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedUsername = normalizeClerkUsername(username);
    const normalizedRole = normalizeInputRole(role);

    const [existingPatientByEmail, existingAdminByEmail] = await Promise.all([
      Patient.findOne({ email: normalizedEmail }),
      Admin.findOne({ email: normalizedEmail })
    ]);
    if (existingPatientByEmail || existingAdminByEmail) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    const [existingPatientUsername, existingAdminUsername] = await Promise.all([
      Patient.findOne({ username: normalizedUsername }),
      Admin.findOne({ username: normalizedUsername })
    ]);
    if (existingPatientUsername || existingAdminUsername) {
      return res.status(409).json({ message: 'User with this username already exists' });
    }

    const clerkClient = getClerkClient();
    if (!clerkClient) {
      return res.status(500).json({ message: 'Clerk is not configured on server. Set CLERK_SECRET_KEY.' });
    }

    const { firstName, lastName } = splitName(String(name).trim());

    let clerkUser;
    try {
      clerkUser = await createClerkUserWithUsernameFallback({
        clerkClient,
        email: normalizedEmail,
        password,
        firstName,
        lastName,
        role: normalizedRole,
        username: normalizedUsername
      });
    } catch (clerkError) {
      const status = Number(clerkError?.status || clerkError?.statusCode || 500);
      const message = clerkError?.errors?.[0]?.longMessage || clerkError?.errors?.[0]?.message || clerkError?.message || 'Failed to create Clerk user';
      return res.status(status >= 400 && status < 500 ? status : 500).json({ message });
    }

    let created;
    try {
      const payload = {
        name: String(name).trim(),
        username: clerkUser.username || normalizedUsername,
        email: normalizedEmail,
        role: normalizedRole,
        phone: phone ? String(phone).trim() : undefined,
        clerkUserId: clerkUser.id
      };

      if (normalizedRole === 'admin') {
        created = await Admin.create({ ...payload, role: 'admin' });
      } else {
        created = await Patient.create(payload);
      }
    } catch (dbError) {
      try {
        await clerkClient.users.deleteUser(clerkUser.id);
      } catch {
      }
      throw dbError;
    }

    const source = normalizedRole === 'admin' ? 'admin-db' : 'patient-db';
    return res.status(201).json({ message: 'User created successfully', user: sanitizeUser(created, source) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create user', error: error.message });
  }
});

router.patch('/admin/users/:userId', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = (({ name, email, role, phone, age, gender, address }) => ({ name, email, role, phone, age, gender, address }))(req.body);

    const found = await findUserByIdAcrossStores(userId);
    if (!found.user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (updates.role !== undefined && !USER_ROLES.includes(updates.role)) {
      return res.status(400).json({ message: 'Invalid role. Allowed roles: patient, doctor, admin.' });
    }

    const currentUser = found.user;
    const currentSource = found.source;
    const targetRole = updates.role !== undefined ? normalizeInputRole(updates.role) : normalizeInputRole(currentUser.role);

    if (updates.email !== undefined) {
      updates.email = normalizeEmail(updates.email);
      if (updates.email !== currentUser.email) {
        const [patientEmailConflict, adminEmailConflict] = await Promise.all([
          Patient.findOne({ email: updates.email, _id: { $ne: currentUser._id } }),
          Admin.findOne({ email: updates.email, _id: { $ne: currentUser._id } })
        ]);
        if (patientEmailConflict || adminEmailConflict) {
          return res.status(409).json({ message: 'Another user already uses this email' });
        }
      }
    }

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        currentUser[key] = value;
      }
    });

    let updatedUser = currentUser;
    let updatedSource = currentSource;

    if (currentSource === 'patient-db' && targetRole === 'admin') {
      const payload = toWritablePayload(currentUser.toObject());
      payload.role = 'admin';
      updatedUser = await Admin.create(payload);
      await currentUser.deleteOne();
      updatedSource = 'admin-db';
    } else if (currentSource === 'admin-db' && targetRole !== 'admin') {
      const payload = toWritablePayload(currentUser.toObject());
      payload.role = targetRole;
      updatedUser = await Patient.create(payload);
      await currentUser.deleteOne();
      updatedSource = 'patient-db';
    } else {
      updatedUser.role = updatedSource === 'admin-db' ? 'admin' : targetRole;
      await updatedUser.save();
    }

    await syncClerkMetadata(updatedUser.clerkUserId, updatedUser.role, updates.name !== undefined ? updatedUser.name : undefined);

    return res.json({ message: 'User updated successfully', user: sanitizeUser(updatedUser, updatedSource) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update user', error: error.message });
  }
});

router.delete('/admin/users/:userId', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.currentUser?._id?.toString() === userId) {
      return res.status(400).json({ message: 'Admin cannot delete own account' });
    }

    const found = await findUserByIdAcrossStores(userId);
    if (!found.user) {
      return res.status(404).json({ message: 'User not found' });
    }

    for (const report of found.user.reports || []) {
      const reportPath = report.filePath?.replace(/^\/+/, '');
      if (reportPath) {
        const absolutePath = path.join(__dirname, '..', reportPath);
        try {
          await fs.promises.unlink(absolutePath);
        } catch (unlinkError) {
          if (unlinkError?.code !== 'ENOENT') {
            throw unlinkError;
          }
        }
      }
    }

    await found.user.deleteOne();

    return res.json({ message: 'User deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete user', error: error.message });
  }
});

router.patch('/admin/users/:userId/role', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!USER_ROLES.includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Allowed roles: patient, doctor, admin.' });
    }

    const found = await findUserByIdAcrossStores(userId);
    if (!found.user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetRole = normalizeInputRole(role);
    let updatedUser = found.user;
    let updatedSource = found.source;

    if (found.source === 'patient-db' && targetRole === 'admin') {
      const payload = toWritablePayload(found.user.toObject());
      payload.role = 'admin';
      updatedUser = await Admin.create(payload);
      await found.user.deleteOne();
      updatedSource = 'admin-db';
    } else if (found.source === 'admin-db' && targetRole !== 'admin') {
      const payload = toWritablePayload(found.user.toObject());
      payload.role = targetRole;
      updatedUser = await Patient.create(payload);
      await found.user.deleteOne();
      updatedSource = 'patient-db';
    } else {
      updatedUser.role = updatedSource === 'admin-db' ? 'admin' : targetRole;
      await updatedUser.save();
    }

    await syncClerkMetadata(updatedUser.clerkUserId, updatedUser.role);

    return res.json({ message: 'User role updated successfully', user: sanitizeUser(updatedUser, updatedSource) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update user role', error: error.message });
  }
});

router.post('/admin/migrate-legacy-users', authMiddleware, requireAdmin, async (_req, res) => {
  try {
    const migration = await migrateLegacyUsersToDomainCollections();
    return res.json({
      message: 'Legacy user migration completed',
      migration
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to migrate legacy users', error: error.message });
  }
});

router.post('/admin/cleanup-test-dbs', authMiddleware, requireAdmin, async (_req, res) => {
  try {
    const cleanup = await dropLegacyTestDatabases();
    return res.json({
      message: 'Test database cleanup completed',
      cleanup
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to cleanup test databases', error: error.message });
  }
});

router.post('/reports', authMiddleware, upload.single('report'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'report file is required (field: report)' });
    }

    const account = await resolveCurrentPatient(req.user, getProfileHints(req));
    if (!account || account.role !== 'patient') {
      return res.status(403).json({ message: 'Reports are only available for patient accounts' });
    }

    await migrateEmbeddedReportsForAccount(account);

    const report = await Report.create({
      patientId: account._id,
      patientEmail: account.email,
      patientName: account.name,
      title: req.body.title,
      description: req.body.description,
      fileName: req.file.filename,
      filePath: `/uploads/reports/${req.file.filename}`,
      mimeType: req.file.mimetype,
      size: req.file.size
    });

    return res.status(201).json({ message: 'Report uploaded successfully', report });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to upload report', error: error.message });
  }
});

router.get('/reports', authMiddleware, async (req, res) => {
  try {
    const account = await resolveCurrentPatient(req.user, getProfileHints(req));
    if (!account || account.role !== 'patient') {
      return res.status(403).json({ message: 'Reports are only available for patient accounts' });
    }

    const reports = await listReportsForAccount(account);
    return res.json({ reports });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch reports', error: error.message });
  }
});

router.patch('/reports/:reportId', authMiddleware, async (req, res) => {
  try {
    const { reportId } = req.params;
    const { title, description } = req.body;

    const account = await resolveCurrentPatient(req.user, getProfileHints(req));
    if (!account || account.role !== 'patient') {
      return res.status(403).json({ message: 'Reports are only available for patient accounts' });
    }

    await migrateEmbeddedReportsForAccount(account);

    const report = await Report.findOne({ _id: reportId, patientId: account._id });
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    if (title !== undefined) report.title = title;
    if (description !== undefined) report.description = description;

    await report.save();

    return res.json({ message: 'Report updated successfully', report });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update report', error: error.message });
  }
});

router.delete('/reports/:reportId', authMiddleware, async (req, res) => {
  try {
    const { reportId } = req.params;

    const account = await resolveCurrentPatient(req.user, getProfileHints(req));
    if (!account || account.role !== 'patient') {
      return res.status(403).json({ message: 'Reports are only available for patient accounts' });
    }

    await migrateEmbeddedReportsForAccount(account);

    const report = await Report.findOne({ _id: reportId, patientId: account._id });
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    const reportPath = report.filePath?.replace(/^\/+/, '');
    if (reportPath) {
      const absolutePath = path.join(__dirname, '..', reportPath);
      try {
        await fs.promises.unlink(absolutePath);
      } catch (unlinkError) {
        if (unlinkError?.code !== 'ENOENT') {
          throw unlinkError;
        }
      }
    }

    await report.deleteOne();

    return res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete report', error: error.message });
  }
});

router.get('/notifications', authMiddleware, async (req, res) => {
  try {
    const account = await resolveCurrentPatient(req.user, getProfileHints(req));
    if (!account) {
      return res.status(404).json({ message: 'Patient profile not found' });
    }
    const role = account.role === 'admin' ? 'admin' : 'patient';
    const data = await listNotificationsForRecipient(account._id, role);
    return res.json(data);
  } catch (error) {
    return res.json({ success: true, unreadCount: 0, notifications: [] });
  }
});

router.patch('/notifications/:notificationId/read', authMiddleware, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const account = await resolveCurrentPatient(req.user, getProfileHints(req));
    if (!account) {
      return res.status(404).json({ message: 'Patient profile not found' });
    }
    const role = account.role === 'admin' ? 'admin' : 'patient';
    await markNotificationReadInternal(notificationId, account._id, role);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to update notification' });
  }
});

router.get('/emails/:id', async (req, res) => {
  try {
    const [patient, admin] = await Promise.all([
      Patient.findById(req.params.id).select('email'),
      Admin.findById(req.params.id).select('email')
    ]);
    const account = patient || admin;
    if (!account) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    res.json({ email: account.email });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [patient, admin] = await Promise.all([
      Patient.findById(req.params.id).select('name email role'),
      Admin.findById(req.params.id).select('name email role')
    ]);
    const account = patient || admin;
    if (!account) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    res.json(account);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
