const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticateJwt, verifyFirebaseToken, getJwtSecret } = require('../middleware/authMiddleware');

const router = express.Router();

const toPublicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  firebaseUid: user.firebaseUid,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

const generateJwt = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role
    },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
};

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email, and password are required' });
    }

    const normalizedEmail = email.toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists' });
    }

    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
      role: role || 'patient'
    });

    const token = generateJwt(user);

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: toPublicUser(user)
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to register', error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateJwt(user);

    return res.json({
      message: 'Login successful',
      token,
      user: toPublicUser(user)
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to login', error: error.message });
  }
});

router.post('/firebase/login', async (req, res) => {
  try {
    const { idToken, role } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: 'idToken is required' });
    }

    const decoded = await verifyFirebaseToken(idToken);
    const email = decoded.email || `${decoded.uid}@firebase.local`;

    let user = await User.findOne({
      $or: [{ firebaseUid: decoded.uid }, { email: email.toLowerCase() }]
    });

    if (!user) {
      user = await User.create({
        name: decoded.name || email,
        email: email.toLowerCase(),
        firebaseUid: decoded.uid,
        role: role || 'patient'
      });
    } else if (!user.firebaseUid) {
      user.firebaseUid = decoded.uid;
      await user.save();
    }

    const token = generateJwt(user);

    return res.json({
      message: 'Firebase login successful',
      token,
      user: toPublicUser(user)
    });
  } catch (error) {
    return res.status(401).json({ message: 'Firebase login failed', error: error.message });
  }
});

router.get('/me', authenticateJwt, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({ user: toPublicUser(user) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch user', error: error.message });
  }
});

router.get('/verify', authenticateJwt, async (req, res) => {
  return res.json({ valid: true, user: req.user });
});

module.exports = router;
