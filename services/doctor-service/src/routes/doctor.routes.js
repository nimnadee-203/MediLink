import express from 'express'
import { loginDoctor } from '../controllers/admin.controller.js'
import {
  approveDoctorAppointment,
  cancelDoctorAppointment,
  getDoctorAppointmentDetails,
  getDoctorById,
  getDoctorUpcomingAppointments,
  listDoctors
} from '../controllers/doctor.controller.js'
import { getDoctorNotifications, markDoctorNotificationRead } from '../controllers/doctorNotification.controller.js'
import { authDoctor } from '../middleware/auth.doctor.js'

const doctorRouter = express.Router()

doctorRouter.post('/login', loginDoctor)
doctorRouter.get('/list', listDoctors)
doctorRouter.get('/appointments/upcoming', authDoctor, getDoctorUpcomingAppointments)
doctorRouter.get('/appointments/:appointmentId', authDoctor, getDoctorAppointmentDetails)
doctorRouter.patch('/appointments/:appointmentId/approve', authDoctor, approveDoctorAppointment)
doctorRouter.patch('/appointments/:appointmentId/cancel', authDoctor, cancelDoctorAppointment)
doctorRouter.get('/notifications', authDoctor, getDoctorNotifications)
doctorRouter.patch('/notifications/:notificationId/read', authDoctor, markDoctorNotificationRead)
doctorRouter.get('/:doctorId', getDoctorById)

export default doctorRouter
