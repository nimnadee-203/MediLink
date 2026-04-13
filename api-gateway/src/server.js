const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();
const port = 8000;

const patientServiceTarget = process.env.PATIENT_SERVICE_URL || 'http://localhost:8002';
const appointmentServiceTarget = process.env.APPOINTMENT_SERVICE_URL || 'http://localhost:8004';

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
  createProxyMiddleware({
    target: patientServiceTarget,
    changeOrigin: true
  })
);

app.use(
  '/api/appointments',
  createProxyMiddleware({
    target: appointmentServiceTarget,
    changeOrigin: true
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
