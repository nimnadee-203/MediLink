import express from 'express';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';

dotenv.config();

const app = express();
const port = 8007;

app.get('/', (req, res) => {
  res.send('Telemedicine Service is running');
});

const startServer = async () => {
    await connectDB();
    app.listen(port, () => {
        console.log(`Telemedicine Service listening at http://localhost:${port}`);
    });
};

startServer();
