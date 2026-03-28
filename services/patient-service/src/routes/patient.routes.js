import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { fileURLToPath } from 'url';
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

const sanitizePatient = (patient) => ({
  id: patient._id,
  name: patient.name,
  email: patient.email,
  phone: patient.phone,
  age: patient.age,
  gender: patient.gender,
  address: patient.address,
  clerkUserId: patient.clerkUserId,
  createdAt: patient.createdAt,
  updatedAt: patient.updatedAt
});

const resolveCurrentPatient = async (user) => {
  const patient = await Patient.findOne({
    $or: [{ clerkUserId: user.id }, { email: user.email }]
  });

  if (patient) {
    let shouldSave = false;

    if (!patient.clerkUserId) {
      patient.clerkUserId = user.id;
      shouldSave = true;
    }

    const hasRealUserEmail = Boolean(user.email && !user.email.endsWith('@clerk.local'));
    const hasPlaceholderPatientEmail = Boolean(patient.email && patient.email.endsWith('@clerk.local'));

    if (hasRealUserEmail && hasPlaceholderPatientEmail) {
      patient.email = user.email;
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
    clerkUserId: user.id,
    phone: user.phone || undefined
  });
  return created;
};

router.post('/register', async (req, res) => {
  return res.status(410).json({ message: 'This service uses Clerk authentication. Sign up from the client app.' });
});

router.post('/login', async (req, res) => {
  return res.status(410).json({ message: 'This service uses Clerk authentication. Sign in from the client app.' });
});

router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const patient = await resolveCurrentPatient(req.user);
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
    const patient = await resolveCurrentPatient(req.user);

    if (!patient) {
      return res.status(404).json({ message: 'Patient profile not found' });
    }

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        patient[key] = value;
      }
    });

    await patient.save();

    return res.json({ message: 'Profile updated successfully', patient: sanitizePatient(patient) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update profile', error: error.message });
  }
});

router.post('/reports', authMiddleware, upload.single('report'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'report file is required (field: report)' });
    }

    const patient = await resolveCurrentPatient(req.user);
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
    const patient = await resolveCurrentPatient(req.user);
    if (!patient) {
      return res.status(404).json({ message: 'Patient profile not found' });
    }

    return res.json({ reports: patient.reports || [] });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch reports', error: error.message });
  }
});

export default router;
