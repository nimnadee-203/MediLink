import express from 'express';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import checkerRoutes from './routes/checker.routes.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 8007;

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Symptom Checker Service is running');
});

app.use('/checker', checkerRoutes);

const startServer = async () => {
    await connectDB();
    const server = app.listen(port, () => {
      console.log(`Symptom Checker Service listening at http://localhost:${port}`);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Stop the running process or change PORT in .env.`);
        process.exit(1);
      }

      console.error('Server startup error:', error);
      process.exit(1);
    });
};

startServer();
