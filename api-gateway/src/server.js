const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();
const port = 8000;

const patientServiceTarget = process.env.PATIENT_SERVICE_URL || 'http://localhost:8002';

app.use(
  '/api/patients',
  createProxyMiddleware({
    target: patientServiceTarget,
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

app.listen(port, () => {
  console.log(`API Gateway listening at http://localhost:${port}`);
});
