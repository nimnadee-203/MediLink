import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import connectCloudinary from './config/cloudinary.js';
import adminRouter from './routes/admin.routes.js';
import doctorRouter from './routes/doctor.routes.js';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const port = process.env.PORT || 4000;

//middlewares
app.use(express.json())
app.use(
  cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'dtoken', 'atoken', 'Dtoken', 'Atoken', 'X-Clerk-Email', 'X-Clerk-Name', 'X-Clerk-Phone']
  })
)

//api endpoints
app.use('/api/admin',adminRouter)
app.use('/api/doctor',doctorRouter)
//localhost:4000/api/admin/add-doctor


app.get('/', (req, res) => {
  res.send('Doctor Service is running');
});

const startServer = async () => {
    await connectDB();
    await connectCloudinary();
    app.listen(port, () => {
        console.log(`Doctor Service listening at http://localhost:${port}`);
    });
};

startServer();
