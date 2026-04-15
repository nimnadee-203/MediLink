import express from 'express';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import notificationRoutes from './routes/notification.routes.js';

dotenv.config();

const app = express();
app.use(express.json());
const port = 8006;

app.use('/api/notifications', notificationRoutes);

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
