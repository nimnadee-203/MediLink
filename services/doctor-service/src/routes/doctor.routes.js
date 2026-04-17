import express from 'express'
import { loginDoctor } from '../controllers/admin.controller.js'
import {
  approveDoctorAppointment,
  cancelDoctorAppointment,
  completeDoctorAppointment,
  createDoctorPrescription,
  getDoctorAppointmentDetails,
  getDoctorById,
  getDoctorCompletedAppointments,
  getDoctorEmail,
  getDoctorUpcomingAppointments,
  listDoctors,
  listPrescriptionsForAppointment,
  listPrescriptionsForPatient
} from '../controllers/doctor.controller.js'
import { getDoctorNotifications, markDoctorNotificationRead } from '../controllers/doctorNotification.controller.js'
import { authDoctor } from '../middleware/auth.doctor.js'

const doctorRouter = express.Router()

doctorRouter.post('/login', loginDoctor)
doctorRouter.get('/list', listDoctors)
doctorRouter.get('/appointments/upcoming', authDoctor, getDoctorUpcomingAppointments)
doctorRouter.get('/appointments/completed', authDoctor, getDoctorCompletedAppointments)
doctorRouter.patch('/appointments/:appointmentId/complete', authDoctor, completeDoctorAppointment)
doctorRouter.get('/prescriptions', authDoctor, listPrescriptionsForAppointment)
doctorRouter.post('/prescriptions', authDoctor, createDoctorPrescription)
doctorRouter.get('/internal/patient-prescriptions', listPrescriptionsForPatient)
doctorRouter.get('/appointments/:appointmentId', authDoctor, getDoctorAppointmentDetails)
doctorRouter.patch('/appointments/:appointmentId/approve', authDoctor, approveDoctorAppointment)
doctorRouter.patch('/appointments/:appointmentId/cancel', authDoctor, cancelDoctorAppointment)
doctorRouter.get('/notifications', authDoctor, getDoctorNotifications)
doctorRouter.patch('/notifications/:notificationId/read', authDoctor, markDoctorNotificationRead)
doctorRouter.get('/emails/:doctorId', getDoctorEmail)
doctorRouter.get('/:doctorId', getDoctorById)

export default doctorRouter