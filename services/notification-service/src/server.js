import express from 'express';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';

dotenv.config();

const app = express();
const port = 8006;

app.get('/', (req, res) => {
  res.send('Notification Service is running');
});

const startServer = async () => {
    await connectDB();
    app.listen(port, () => {
        console.log(`Notification Service listening at http://localhost:${port}`);
    });
};

startServer();
