import express from 'express'
import { addDoctor,adminDashboard,loginAdmin } from '../controllers/admin.controller.js'
import upload from '../middleware/multer.js'
import { authAdmin } from '../middleware/auth.admin.js'


const adminRouter = express.Router()

adminRouter.post('/add-doctor',authAdmin,upload.single('image'),addDoctor)
adminRouter.post('/login',loginAdmin)
adminRouter.get('/dashboard',adminDashboard)

export default adminRouter;