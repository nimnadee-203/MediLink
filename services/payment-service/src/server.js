import express from 'express';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import paymentRoutes from './routes/payment.routes.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 8019;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Payment Service is running');
});

app.use('/payments', paymentRoutes);

const startServer = async () => {
    await connectDB();
    const server = app.listen(port, () => {
      console.log(`Payment Service listening at http://localhost:${port}`);
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
