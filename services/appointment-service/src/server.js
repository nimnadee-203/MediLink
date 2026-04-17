import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import appointmentRoutes from './routes/appointment.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const port = process.env.PORT || 8004;
const requireDb =
  process.env.REQUIRE_DB === 'true' || process.env.NODE_ENV === 'production';

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
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

app.use(express.json());
app.use('/api/appointments', appointmentRoutes);

app.get('/', (req, res) => {
  res.send('Appointment Service is running');
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'appointment-service' });
});

const startServer = async () => {
  let dbConnected = false;

  try {
    await connectDB();
    dbConnected = true;
  } catch (error) {
    console.error('CRITICAL: Failed to connect to MongoDB Atlas!', error.message);
    console.error('Check your Atlas IP Whitelist and your .env credentials.');
    process.exit(1);
  }

  app.listen(port, () => {
    console.log(`Appointment Service listening at http://localhost:${port}`);
    console.log('✅ MongoDB Connection Verified');
  });
};

startServer();
