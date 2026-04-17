import express from 'express';
import { generateJitsiToken } from '../controllers/telemedicine.controller.js';

const router = express.Router();

router.post('/token', generateJitsiToken);

export default router;
