import jwt from 'jsonwebtoken';
import doctorModel from '../models/Doctor.js';

const decodeJwtPayloadUnsafe = (token) => {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid bearer token');
  }

  const base64Url = parts[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4 || 4)) % 4);
  const payloadJson = Buffer.from(padded, 'base64').toString('utf8');
  const payload = JSON.parse(payloadJson);

  if (!payload?.sub) {
    throw new Error('Bearer payload missing subject');
  }

  if (payload?.exp && Date.now() >= payload.exp * 1000) {
    throw new Error('Bearer token expired');
  }

  return payload;
};

export const authDoctor = async (req, res, next) => {
  try {
    const dtoken = req.headers.dtoken;
    if (dtoken) {
      const tokenDecode = jwt.verify(dtoken, process.env.JWT_SECRET);
      if (!tokenDecode?.id) {
        return res.json({ success: false, message: 'Invalid doctor token' });
      }

      req.doctorId = String(tokenDecode.id);
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({ success: false, message: 'Not Authorized Login Again' });
    }

    const bearerToken = authHeader.split(' ')[1];
    const payload = decodeJwtPayloadUnsafe(bearerToken);
    const clerkUserId = String(payload?.sub || '').trim();
    const hintedEmail = String(req.headers['x-clerk-email'] || '').trim().toLowerCase();
    const tokenEmail = String(payload?.email || payload?.email_address || '').trim().toLowerCase();
    const doctorEmail = hintedEmail || tokenEmail;

    if (!clerkUserId && !doctorEmail) {
      return res.json({ success: false, message: 'Doctor identity is required for Clerk login' });
    }

    const doctor = await doctorModel.findOne({
      $or: [
        ...(clerkUserId ? [{ clerkUserId }] : []),
        ...(doctorEmail ? [{ email: doctorEmail }] : [])
      ]
    }).select('_id status').lean();
    if (!doctor) {
      return res.json({ success: false, message: 'Doctor account not found for this Clerk user' });
    }

    if (doctor.status === 'rejected') {
      return res.json({ success: false, message: 'Doctor account is not approved' });
    }

    req.doctorId = String(doctor._id);
    req.headers.dtoken = jwt.sign({ id: req.doctorId }, process.env.JWT_SECRET, { expiresIn: '12h' });
    return next();
  } catch (error) {
    console.log(error);
    return res.json({ success: false, message: error.message });
  }
};
