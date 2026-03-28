import express from 'express';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';

dotenv.config();

const app = express();
const port = 8002;

app.get('/', (req, res) => {
  res.send('Patient Service is running');
});

const startServer = async () => {
    await connectDB();
    app.listen(port, () => {
        console.log(`Patient Service listening at http://localhost:${port}`);
    });
};

startServer();
