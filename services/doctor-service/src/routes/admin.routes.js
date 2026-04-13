import express from 'express'
import { addDoctor, adminDashboard, allDoctors, changeAvailability, deleteDoctor, loginAdmin, updateDoctor } from '../controllers/admin.controller.js'
import upload from '../middleware/multer.js'
import { authAdmin } from '../middleware/auth.admin.js'


const adminRouter = express.Router()

adminRouter.post('/add-doctor', authAdmin, upload.single('image'), addDoctor)
adminRouter.post('/login', loginAdmin)
adminRouter.post('/all-doctors', authAdmin, allDoctors)
adminRouter.get('/dashboard', authAdmin, adminDashboard)
adminRouter.post('/change-availability', authAdmin, changeAvailability)
adminRouter.post('/update-doctor', authAdmin, upload.single('image'), updateDoctor)
adminRouter.post('/delete-doctor', authAdmin, deleteDoctor)

export default adminRouter;