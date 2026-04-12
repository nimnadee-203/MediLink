import express from 'express';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import appointmentRoutes from './routes/appointment.routes.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 8004;
const requireDb =
  process.env.REQUIRE_DB === 'true' || process.env.NODE_ENV === 'production';

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
    if (requireDb) {
      console.error('Failed to start appointment service', error);
      process.exit(1);
    }

    console.error(
      'MongoDB unavailable. Starting appointment service in degraded mode (database routes may fail).'
    );
    console.error(error.message);
  }

  app.listen(port, () => {
    console.log(`Appointment Service listening at http://localhost:${port}`);
    if (!dbConnected) {
      console.log('Running without MongoDB connection (REQUIRE_DB=false).');
    }
  });
};

startServer();
