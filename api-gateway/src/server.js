const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const port = process.env.PORT || 8000;

const patientServiceTarget = process.env.PATIENT_SERVICE_URL || 'http://localhost:8002';
const appointmentServiceTarget = process.env.APPOINTMENT_SERVICE_URL || 'http://localhost:8004';
const clerkSecretKey = process.env.CLERK_SECRET_KEY;

let verifyTokenLoader;
let warnedMissingClerkKey = false;

const getVerifyToken = async () => {
  if (!verifyTokenLoader) {
    verifyTokenLoader = import('@clerk/backend').then((mod) => mod.verifyToken);
  }
  return verifyTokenLoader;
};

const withAuthContext = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  if (!clerkSecretKey || /replace_with/i.test(clerkSecretKey)) {
    if (!warnedMissingClerkKey) {
      console.warn('[api-gateway] CLERK_SECRET_KEY missing/placeholder. Passing auth through without gateway verification.');
      warnedMissingClerkKey = true;
    }
    return next();
  }

  try {
    const token = authHeader.split(' ')[1];
    const verifyToken = await getVerifyToken();
    const payload = await verifyToken(token, { secretKey: clerkSecretKey });

    const resolvedName =
      payload.name || [payload.first_name, payload.last_name].filter(Boolean).join(' ').trim();

    const resolvedEmail = payload.email || payload.email_address || '';
    const resolvedPhone = payload.phone_number || '';

    req.headers['x-auth-user-id'] = payload.sub;
    if (!req.headers['x-clerk-email'] && resolvedEmail) {
      req.headers['x-clerk-email'] = resolvedEmail;
    }
    if (!req.headers['x-clerk-name'] && resolvedName) {
      req.headers['x-clerk-name'] = resolvedName;
    }
    if (!req.headers['x-clerk-phone'] && resolvedPhone) {
      req.headers['x-clerk-phone'] = resolvedPhone;
    }

    return next();
  } catch (error) {
    return res.status(401).json({
      message: 'Invalid or expired token',
      error: error?.message || 'Unauthorized'
    });
  }
};

const createServiceProxy = (target) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    onProxyReq: (proxyReq, req) => {
      const forwardedHeaders = ['authorization', 'x-auth-user-id', 'x-clerk-email', 'x-clerk-name', 'x-clerk-phone'];
      for (const header of forwardedHeaders) {
        const value = req.headers[header];
        if (value) {
          proxyReq.setHeader(header, value);
        }
      }
    }
  });

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Clerk-Email, X-Clerk-Name, X-Clerk-Phone');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  return next();
});

app.use(
  '/api/patients',
  withAuthContext,
  createServiceProxy(patientServiceTarget)
);

app.use(
  '/api/appointments',
  withAuthContext,
  createServiceProxy(appointmentServiceTarget)
);

app.use(
  '/patient-uploads',
  createProxyMiddleware({
    target: patientServiceTarget,
    changeOrigin: true,
    pathRewrite: {
      '^/patient-uploads': '/uploads'
    }
  })
);

app.get('/', (req, res) => {
  res.send('API Gateway is running');
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'api-gateway' });
});

app.listen(port, () => {
  console.log(`API Gateway listening at http://localhost:${port}`);
});
