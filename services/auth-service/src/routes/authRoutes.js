const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticateJwt, getJwtSecret } = require('../middleware/authMiddleware');


const router = express.Router();
// creates a safe user object to send back to frontend.
const toPublicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

// This creates a JWT token.
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

// This route is used to create a new account.
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Basic validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email, and password are required' });
    }

    // Make email lowercase
    const normalizedEmail = email.toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail }); // check user already exists 
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists' });
    }
    // if no account then create new account and return token
    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
      role: role || 'patient' // default role is patient
    });

    const token = generateJwt(user); // jwt token is generated for the user

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: toPublicUser(user)
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to register', error: error.message });
  }
});

// Login route
router.post('/login', async (req, res) => {
  try {
    // email and password are required to login
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }

    // find the user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // not match
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateJwt(user); // genarate token 

    return res.json({
      message: 'Login successful',
      token,
      user: toPublicUser(user)
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to login', error: error.message });
  }
});

// This route gets the currently logged-in user.
router.get('/me', authenticateJwt, async (req, res) => { // authenticate jwt is valid 
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

// verfy route 
router.get('/verify', authenticateJwt, async (req, res) => {
  return res.json({ valid: true, user: req.user });
});

module.exports = router;
