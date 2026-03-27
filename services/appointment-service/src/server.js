import express from 'express';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';

dotenv.config();

const app = express();
const port = 8004;

app.get('/', (req, res) => {
  res.send('Appointment Service is running');
});

const startServer = async () => {
    await connectDB();
    app.listen(port, () => {
        console.log(`Appointment Service listening at http://localhost:${port}`);
    });
};

startServer();
