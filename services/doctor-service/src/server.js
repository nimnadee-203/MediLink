import express from 'express';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import connectCloudinary from './config/cloudinary.js';
import adminRouter from './routes/admin.routes.js';
import doctorRouter from './routes/doctor.routes.js';
import cors from 'cors';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

//middlewares
app.use(express.json())
app.use(cors())

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
