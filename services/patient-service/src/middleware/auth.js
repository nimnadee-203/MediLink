const admin = require('firebase-admin');

let firebaseInitialized = false;

const initFirebase = () => {
  if (firebaseInitialized) {
    return;
  }

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;

  if (!FIREBASE_PROJECT_ID) {
    return;
  }

  if (FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    });
  } else {
    admin.initializeApp({
      projectId: FIREBASE_PROJECT_ID
    });
  }

  firebaseInitialized = true;
};

const verifyFirebaseToken = async (token) => {
  initFirebase();
  if (!firebaseInitialized) {
    throw new Error('Firebase Admin is not configured. Set FIREBASE_PROJECT_ID (and optionally FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY).');
  }

  const decoded = await admin.auth().verifyIdToken(token);
  return { id: decoded.uid, email: decoded.email, name: decoded.name, authType: 'firebase' };
};

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization token is required' });
    }

    const token = authHeader.split(' ')[1];
    req.user = await verifyFirebaseToken(token);

    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token', error: error.message });
  }
};

module.exports = {
  authMiddleware,
  verifyFirebaseToken
};
