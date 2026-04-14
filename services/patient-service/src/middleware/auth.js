import { verifyToken } from '@clerk/backend';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const getClerkSecretKey = () => {
  const secretKey = process.env.CLERK_SECRET_KEY;

  if (!secretKey || /replace_with/i.test(secretKey)) {
    return null;
  }

  return secretKey;
};

const decodeJwtPayloadUnsafe = (token) => {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT form. A JWT consists of three parts separated by dots.');
  }

  const base64Url = parts[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4 || 4)) % 4);
  const payloadJson = Buffer.from(padded, 'base64').toString('utf8');
  const payload = JSON.parse(payloadJson);

  if (!payload?.sub) {
    throw new Error('Token payload missing required subject (sub).');
  }

  if (payload?.exp && Date.now() >= payload.exp * 1000) {
    throw new Error('Token is expired. Please sign in again.');
  }

  return payload;
};

const verifyClerkToken = async (token) => {
  const secretKey = getClerkSecretKey();

  let payload;

  if (secretKey) {
    try {
      payload = await verifyToken(token, { secretKey });
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        // Dev fallback for mismatched Clerk keys across local services.
        payload = decodeJwtPayloadUnsafe(token);
      } else {
        throw error;
      }
    }
  } else if (process.env.NODE_ENV !== 'production') {
    payload = decodeJwtPayloadUnsafe(token);
  } else {
    throw new Error('Clerk backend secret key is not configured. Set a real CLERK_SECRET_KEY in services/patient-service/.env');
  }

  const fullName = payload.name || [payload.first_name, payload.last_name].filter(Boolean).join(' ').trim();

  return {
    id: payload.sub,
    email: payload.email || payload.email_address || '',
    name: fullName,
    phone: payload.phone_number || '',
    authType: 'clerk'
  };
};

const authMiddleware = async (req, res, next) => {
  try {
    const { atoken } = req.headers;
    const authHeader = req.headers.authorization;

    // Check for Admin atoken FIRST
    if (atoken) {
      try {
        const decoded = jwt.verify(atoken, process.env.JWT_SECRET || 'shanuka');
        if (decoded) {
          // Provide a structure that resolveCurrentPatient can use
          req.user = { 
            id: 'admin', 
            email: process.env.ADMIN_EMAIL || 'admin@medisync.com', 
            role: 'admin', 
            authType: 'admin' 
          };
          return next();
        }
      } catch (err) {
        console.log("Admin token verification failed in patient-service, trying Clerk...");
      }
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization token is required' });
    }

    const token = authHeader.split(' ')[1];
    req.user = await verifyClerkToken(token);

    return next();
  } catch (error) {
    if (/secret key is not configured/i.test(error.message)) {
      return res.status(500).json({ message: error.message });
    }

    return res.status(401).json({ message: 'Invalid or expired Clerk token', error: error.message });
  }
};

export {
  authMiddleware,
  verifyClerkToken
};
