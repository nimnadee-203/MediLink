const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');

let firebaseInitialized = false;

const getJwtSecret = () => process.env.JWT_SECRET || 'medisync_dev_secret';

const initFirebase = () => {
  if (firebaseInitialized) {
    return;
  }

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;

  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    return;
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
  });

  firebaseInitialized = true;
};

const verifyFirebaseToken = async (idToken) => {
  initFirebase();

  if (!firebaseInitialized) {
    throw new Error('Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.');
  }

  const decoded = await admin.auth().verifyIdToken(idToken);
  return decoded;
};

const authenticateJwt = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization token is required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, getJwtSecret());

    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token', error: error.message });
  }
};

module.exports = {
  authenticateJwt,
  verifyFirebaseToken,
  getJwtSecret
};
