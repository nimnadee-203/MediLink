import express from 'express';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import paymentRoutes from './routes/payment.routes.js';
import { handleStripeWebhook } from './controllers/webhook.controller.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const port = Number(process.env.PORT) || 8019;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
});

// Webhook must be BEFORE JSON parser to receive raw body
app.post('/payments/webhook', express.raw({type: 'application/json'}), handleStripeWebhook);

// Then apply JSON parser for other routes
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
