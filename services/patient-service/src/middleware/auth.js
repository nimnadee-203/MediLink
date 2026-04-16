import { verifyToken } from '@clerk/backend';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();
// This function gets the Clerk secret key from
const getClerkSecretKey = () => {
  const secretKey = process.env.CLERK_SECRET_KEY;

  if (!secretKey || /replace_with/i.test(secretKey)) {
    return null;
  }

  return secretKey;
};

// This function finds the main admin email.
const getPrimaryAdminEmail = () => {
  const candidates = [
    ...(process.env.ADMIN_EMAILS || '').split(','),
    process.env.ADMIN_EMAIL,
    'admin@medisync.ai',
    'it23589254@my.sliit.lk'
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);

  return candidates[0] || 'admin@medisync.ai';
};

// This function decodes a JWT token without fully verifying it.
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

const extractEmailFromPayload = (payload = {}) => {
  const direct = [
    payload.email,
    payload.email_address,
    payload.primary_email_address,
    payload.primaryEmailAddress
  ].find((value) => typeof value === 'string' && value.trim());

  if (direct) {
    return String(direct).trim();
  }

  const fromArray = [
    payload.email_addresses,
    payload.emailAddresses,
    payload.emails
  ].find(Array.isArray);

  if (Array.isArray(fromArray)) {
    const first = fromArray
      .map((entry) => (typeof entry === 'string' ? entry : entry?.email_address || entry?.emailAddress || entry?.address))
      .find((value) => typeof value === 'string' && value.trim());
    if (first) {
      return String(first).trim();
    }
  }

  return '';
};

const extractPhoneFromPayload = (payload = {}) => {
  const direct = [
    payload.phone_number,
    payload.phoneNumber,
    payload.primary_phone_number,
    payload.primaryPhoneNumber
  ].find((value) => typeof value === 'string' && value.trim());

  if (direct) {
    return String(direct).trim();
  }

  const fromArray = [
    payload.phone_numbers,
    payload.phoneNumbers
  ].find(Array.isArray);

  if (Array.isArray(fromArray)) {
    const first = fromArray
      .map((entry) => (typeof entry === 'string' ? entry : entry?.phone_number || entry?.phoneNumber || entry?.number))
      .find((value) => typeof value === 'string' && value.trim());
    if (first) {
      return String(first).trim();
    }
  }

  return '';
};

// This function checks a Clerk token and returns clean user data.
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
  const metadataRole = payload?.public_metadata?.role || payload?.metadata?.role || payload?.unsafe_metadata?.role;
  const resolvedRole = metadataRole === 'admin' || metadataRole === 'doctor' || metadataRole === 'patient'
    ? metadataRole
    : undefined;

  return {
    id: payload.sub,
    email: extractEmailFromPayload(payload),
    name: fullName,
    phone: extractPhoneFromPayload(payload),
    role: resolvedRole,
    authType: 'clerk'
  };
};

// This is the main middleware.
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
            id: decoded?.id || decoded?._id || 'legacy-admin-token', 
            email: getPrimaryAdminEmail(), 
            role: 'admin', 
            authType: 'admin',
            forceAdmin: true
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
