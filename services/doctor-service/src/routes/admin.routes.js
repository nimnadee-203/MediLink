import express from 'express'
import { addDoctor,adminDashboard } from '../controllers/admin.controller.js'
import upload from '../middleware/multer.js'


const adminRouter = express.Router()

adminRouter.post('/add-doctor',upload.single('image'),addDoctor)
adminRouter.get('/dashboard',adminDashboard)

export default adminRouter;