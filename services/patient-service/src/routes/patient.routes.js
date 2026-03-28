const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Patient = require('../models/Patient');
const { authMiddleware, verifyFirebaseToken } = require('../middleware/auth');

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
  firebaseUid: patient.firebaseUid,
  createdAt: patient.createdAt,
  updatedAt: patient.updatedAt
});

const resolveCurrentPatient = async (user) => {
  const patient = await Patient.findOne({
    $or: [{ firebaseUid: user.id }, { email: user.email }]
  });

  if (patient) {
    if (!patient.firebaseUid) {
      patient.firebaseUid = user.id;
      await patient.save();
    }
    return patient;
  }

  const created = await Patient.create({
    name: user.name || user.email || user.phone || 'Firebase User',
    email: user.email || `${user.id}@firebase.local`,
    firebaseUid: user.id,
    phone: user.phone || undefined
  });
  return created;
};

router.post('/register', async (req, res) => {
  return res.status(410).json({ message: 'Email/password registration is disabled. Use Firebase OTP authentication.' });
});

router.post('/login', async (req, res) => {
  return res.status(410).json({ message: 'Email/password login is disabled. Use Firebase OTP authentication.' });
});

router.post('/firebase/login', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ message: 'idToken is required' });
    }

    const user = await verifyFirebaseToken(idToken);
    const patient = await resolveCurrentPatient(user);

    return res.json({ message: 'Firebase login successful', token: idToken, patient: sanitizePatient(patient) });
  } catch (error) {
    return res.status(401).json({ message: 'Firebase login failed', error: error.message });
  }
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

module.exports = router;
