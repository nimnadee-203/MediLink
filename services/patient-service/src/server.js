import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';
import patientRoutes from './routes/patient.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const port = process.env.PORT || 8002;

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/patients', patientRoutes);

app.get('/', (req, res) => {
  res.send('Patient Service is running');
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'patient-service' });
});

const startServer = async () => {
    await connectDB();
    app.listen(port, () => {
        console.log(`Patient Service listening at http://localhost:${port}`);
    });
};

startServer();
