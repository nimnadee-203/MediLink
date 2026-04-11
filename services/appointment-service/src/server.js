import express from 'express';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import appointmentRoutes from './routes/appointment.routes.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 8004;

app.use(express.json());
app.use('/api/appointments', appointmentRoutes);

app.get('/', (req, res) => {
  res.send('Appointment Service is running');
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'appointment-service' });
});

const startServer = async () => {
  try {
    await connectDB();
    app.listen(port, () => {
      console.log(`Appointment Service listening at http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Failed to start appointment service', error);
    process.exit(1);
  }
};

startServer();
