const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const port = process.env.PORT || 8000;

const patientServiceTarget = process.env.PATIENT_SERVICE_URL || 'http://localhost:8002';
const appointmentServiceTarget = process.env.APPOINTMENT_SERVICE_URL || 'http://localhost:8004';
const doctorServiceTarget = process.env.DOCTOR_SERVICE_URL || 'http://localhost:4000';
const telemedicineServiceTarget = process.env.TELEMEDICINE_SERVICE_URL || 'http://localhost:8007';
const symptomCheckerServiceTarget = process.env.SYMPTOM_CHECKER_SERVICE_URL || 'http://localhost:8010';
const paymentServiceTarget = process.env.PAYMENT_SERVICE_URL || 'http://localhost:8019';
const clerkSecretKey = process.env.CLERK_SECRET_KEY;

/** Express may strip the mount path before HPM runs pathRewrite; normalize to target /checker prefix. */
const rewriteGatewayCheckerPath = (path) => {
  const pathname = String(path || '').split('?')[0] || '/';
  const clean = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (clean.startsWith('/api/checker')) {
    return clean.replace(/^\/api\/checker/, '/checker');
  }
  if (clean.startsWith('/checker')) {
    return clean;
  }
  return `/checker${clean}`;
};

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
      const forwardedHeaders = [
        'authorization',
        'dtoken',
        'atoken',
        'x-auth-user-id',
        'x-clerk-email',
        'x-clerk-name',
        'x-clerk-phone'
      ];
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
  // Single line — duplicate Access-Control-Allow-Headers overwrite each other and previously dropped dtoken (doctor dashboard).
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, dtoken, Dtoken, atoken, Atoken, X-Clerk-Email, X-Clerk-Name, X-Clerk-Phone'
  );
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

app.use('/api/doctor', createServiceProxy(doctorServiceTarget));

app.use('/api/admin', createServiceProxy(doctorServiceTarget));

app.use(
  '/api/telemedicine',
  withAuthContext,
  createServiceProxy(telemedicineServiceTarget)
);

app.use(
  '/api/checker',
  withAuthContext,
  createProxyMiddleware({
    target: symptomCheckerServiceTarget,
    changeOrigin: true,
    pathRewrite: rewriteGatewayCheckerPath,
    onProxyReq: (proxyReq, req) => {
      const forwardedHeaders = [
        'authorization',
        'dtoken',
        'atoken',
        'x-auth-user-id',
        'x-clerk-email',
        'x-clerk-name',
        'x-clerk-phone'
      ];
      for (const header of forwardedHeaders) {
        const value = req.headers[header];
        if (value) {
          proxyReq.setHeader(header, value);
        }
      }
    }
  })
);

app.use(
  '/api/payments',
  createProxyMiddleware({
    target: paymentServiceTarget,
    changeOrigin: true,
    pathRewrite: (path) => {
      const pathname = String(path || '').split('?')[0] || '/';
      const clean = pathname.startsWith('/') ? pathname : `/${pathname}`;
      if (clean.startsWith('/api/payments')) {
        return clean.replace(/^\/api\/payments/, '/payments');
      }
      if (clean.startsWith('/payments')) {
        return clean;
      }
      return `/payments${clean}`;
    }
  })
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
