import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { createClerkClient } from '@clerk/backend';
import Patient from '../models/Patient.js';
import { authMiddleware } from '../middleware/auth.js';

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

const parseAdminEmails = () =>
  (process.env.ADMIN_EMAILS || 'admin@medisync.ai')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

const isAdminEmail = (email) => {
  if (!email) return false;
  return parseAdminEmails().includes(email.toLowerCase());
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

const sanitizePatient = (patient) => ({
  id: patient._id,
  name: patient.name,
  username: patient.username,
  email: patient.email,
  role: patient.role || 'patient',
  phone: patient.phone,
  age: patient.age,
  gender: patient.gender,
  address: patient.address,
  clerkUserId: patient.clerkUserId,
  createdAt: patient.createdAt,
  updatedAt: patient.updatedAt
});

const getProfileHints = (req) => ({
  email: req.headers['x-clerk-email'] || '',
  name: req.headers['x-clerk-name'] || '',
  phone: req.headers['x-clerk-phone'] || ''
});

const resolveCurrentPatient = async (user, profileHints = {}) => {
  const patient = await Patient.findOne({
    $or: [{ clerkUserId: user.id }, { email: user.email }]
  });

  if (patient) {
    let shouldSave = false;

    if (!patient.clerkUserId) {
      patient.clerkUserId = user.id;
      shouldSave = true;
    }

    if (!patient.role) {
      patient.role = isAdminEmail(patient.email || user.email) ? 'admin' : 'patient';
      shouldSave = true;
    }

    const effectiveEmailForRole = user.email || patient.email;
    const shouldBeAdmin = isAdminEmail(effectiveEmailForRole) || isAdminClerkUserId(user.id) || isAdminClerkUserId(patient.clerkUserId);
    if (shouldBeAdmin && patient.role !== 'admin') {
      patient.role = 'admin';
      shouldSave = true;
    }

    const hasRealUserEmail = Boolean(user.email && !user.email.endsWith('@clerk.local'));
    const hasPlaceholderPatientEmail = Boolean(patient.email && patient.email.endsWith('@clerk.local'));

    if (hasRealUserEmail && hasPlaceholderPatientEmail) {
      patient.email = user.email;
      shouldSave = true;
    }

    const hintedEmail = typeof profileHints.email === 'string' ? profileHints.email.trim() : '';
    const hasRealHintedEmail = Boolean(hintedEmail && !hintedEmail.endsWith('@clerk.local'));
    if (hasRealHintedEmail && hasPlaceholderPatientEmail) {
      patient.email = hintedEmail.toLowerCase();
      shouldSave = true;
    }

    const hintedName = typeof profileHints.name === 'string' ? profileHints.name.trim() : '';
    if (hintedName && (!patient.name || patient.name === 'Clerk User')) {
      patient.name = hintedName;
      shouldSave = true;
    }

    const hintedPhone = typeof profileHints.phone === 'string' ? profileHints.phone.trim() : '';
    if (hintedPhone && !patient.phone) {
      patient.phone = hintedPhone;
      shouldSave = true;
    }

    if (shouldSave) {
      await patient.save();
    }

    return patient;
  }

  const created = await Patient.create({
    name: user.name || user.email || user.phone || 'Clerk User',
    email: user.email || `${user.id}@clerk.local`,
    role: isAdminEmail(user.email) || isAdminClerkUserId(user.id) ? 'admin' : 'patient',
    clerkUserId: user.id,
    phone: user.phone || undefined
  });
  return created;
};

const requireAdmin = async (req, res, next) => {
  try {
    const currentUser = await resolveCurrentPatient(req.user, getProfileHints(req));
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    req.currentUser = currentUser;
    return next();
  } catch (error) {
    return res.status(500).json({ message: 'Failed to validate admin access', error: error.message });
  }
};

router.post('/register', async (req, res) => {
  return res.status(410).json({ message: 'This service uses Clerk authentication. Sign up from the client app.' });
});

router.post('/login', async (req, res) => {
  return res.status(410).json({ message: 'This service uses Clerk authentication. Sign in from the client app.' });
});

router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const patient = await resolveCurrentPatient(req.user, getProfileHints(req));
    if (!patient) {
      return res.status(404).json({ message: 'Patient profile not found' });
    }

    return res.json({ patient: sanitizePatient(patient) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch profile', error: error.message });
  }
});

router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const updates = (({ name, phone, age, gender, address }) => ({ name, phone, age, gender, address }))(req.body);
    const patient = await resolveCurrentPatient(req.user, getProfileHints(req));

    if (!patient) {
      return res.status(404).json({ message: 'Patient profile not found' });
    }

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        patient[key] = value;
      }
    });

    await patient.save();

    const clerkClient = getClerkClient();
    if (clerkClient && updates.name !== undefined) {
      const { firstName, lastName } = splitName(updates.name);
      await clerkClient.users.updateUser(req.user.id, {
        firstName,
        lastName
      });
    }

    return res.json({ message: 'Profile updated successfully', patient: sanitizePatient(patient) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update profile', error: error.message });
  }
});

router.get('/admin/users', authMiddleware, requireAdmin, async (_req, res) => {
  try {
    const users = await Patient.find({}).sort({ createdAt: -1 });
    return res.json({ users: users.map(sanitizePatient) });
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

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedUsername = normalizeClerkUsername(username);

    const existing = await Patient.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    const existingUsername = await Patient.findOne({ username: normalizedUsername });
    if (existingUsername) {
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
        role,
        username: normalizedUsername
      });
    } catch (clerkError) {
      const status = Number(clerkError?.status || clerkError?.statusCode || 500);
      const message = clerkError?.errors?.[0]?.longMessage || clerkError?.errors?.[0]?.message || clerkError?.message || 'Failed to create Clerk user';
      return res.status(status >= 400 && status < 500 ? status : 500).json({ message });
    }

    let created;
    try {
      created = await Patient.create({
        name: String(name).trim(),
        username: clerkUser.username || normalizedUsername,
        email: normalizedEmail,
        role,
        phone: phone ? String(phone).trim() : undefined,
        clerkUserId: clerkUser.id
      });
    } catch (dbError) {
      try {
        await clerkClient.users.deleteUser(clerkUser.id);
      } catch {
      }
      throw dbError;
    }

    return res.status(201).json({ message: 'User created successfully', user: sanitizePatient(created) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create user', error: error.message });
  }
});

router.patch('/admin/users/:userId', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = (({ name, email, role, phone, age, gender, address }) => ({ name, email, role, phone, age, gender, address }))(req.body);

    const user = await Patient.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (updates.role !== undefined && !USER_ROLES.includes(updates.role)) {
      return res.status(400).json({ message: 'Invalid role. Allowed roles: patient, doctor, admin.' });
    }

    if (updates.email !== undefined) {
      updates.email = String(updates.email).trim().toLowerCase();
      if (updates.email !== user.email) {
        const existing = await Patient.findOne({ email: updates.email, _id: { $ne: user._id } });
        if (existing) {
          return res.status(409).json({ message: 'Another user already uses this email' });
        }
      }
    }

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        user[key] = value;
      }
    });

    await user.save();

    const clerkClient = getClerkClient();
    if (clerkClient && user.clerkUserId) {
      if (updates.role !== undefined) {
        await clerkClient.users.updateUserMetadata(user.clerkUserId, {
          publicMetadata: { role: user.role }
        });
      }

      if (updates.name !== undefined) {
        const { firstName, lastName } = splitName(user.name);
        await clerkClient.users.updateUser(user.clerkUserId, {
          firstName,
          lastName
        });
      }
    }

    return res.json({ message: 'User updated successfully', user: sanitizePatient(user) });
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

    const user = await Patient.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    for (const report of user.reports || []) {
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

    await user.deleteOne();

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

    const user = await Patient.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.role = role;
    await user.save();

    const clerkClient = getClerkClient();
    if (clerkClient && user.clerkUserId) {
      await clerkClient.users.updateUserMetadata(user.clerkUserId, {
        publicMetadata: { role }
      });
    }

    return res.json({ message: 'User role updated successfully', user: sanitizePatient(user) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update user role', error: error.message });
  }
});

router.post('/reports', authMiddleware, upload.single('report'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'report file is required (field: report)' });
    }

    const patient = await resolveCurrentPatient(req.user, getProfileHints(req));
    if (!patient) {
      return res.status(404).json({ message: 'Patient profile not found' });
    }

    const report = {
      title: req.body.title,
      description: req.body.description,
      fileName: req.file.filename,
      filePath: `/uploads/reports/${req.file.filename}`,
      mimeType: req.file.mimetype,
      size: req.file.size
    };

    patient.reports.push(report);
    await patient.save();

    return res.status(201).json({ message: 'Report uploaded successfully', report: patient.reports[patient.reports.length - 1] });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to upload report', error: error.message });
  }
});

router.get('/reports', authMiddleware, async (req, res) => {
  try {
    const patient = await resolveCurrentPatient(req.user, getProfileHints(req));
    if (!patient) {
      return res.status(404).json({ message: 'Patient profile not found' });
    }

    return res.json({ reports: patient.reports || [] });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch reports', error: error.message });
  }
});

router.patch('/reports/:reportId', authMiddleware, async (req, res) => {
  try {
    const { reportId } = req.params;
    const { title, description } = req.body;

    const patient = await resolveCurrentPatient(req.user, getProfileHints(req));
    if (!patient) {
      return res.status(404).json({ message: 'Patient profile not found' });
    }

    const report = patient.reports.id(reportId);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    if (title !== undefined) report.title = title;
    if (description !== undefined) report.description = description;

    await patient.save();

    return res.json({ message: 'Report updated successfully', report });
  } catch (error) {
    console.error('Failed to update report:', error);
    return res.status(500).json({ message: 'Failed to update report', error: error.message });
  }
});

router.delete('/reports/:reportId', authMiddleware, async (req, res) => {
  try {
    const { reportId } = req.params;

    const patient = await resolveCurrentPatient(req.user, getProfileHints(req));
    if (!patient) {
      return res.status(404).json({ message: 'Patient profile not found' });
    }

    const report = patient.reports.id(reportId);
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

    patient.reports = patient.reports.filter((item) => item._id.toString() !== reportId);
    await patient.save();

    return res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Failed to delete report:', error);
    return res.status(500).json({ message: 'Failed to delete report', error: error.message });
  }
});

export default router;
