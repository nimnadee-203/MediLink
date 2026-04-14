import express from "express";
import {
  cancelAppointment,
  createAppointment,
  getAppointmentById,
  getAppointmentStatus,
  listAppointments,
  updatePatientAppointment,
  updateAppointment
} from "../controllers/appointment.controller.js";
import { authenticateJwt } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticateJwt);

router.get("/", listAppointments);
router.post("/", createAppointment);
router.get("/:id", getAppointmentById);
router.get("/:id/status", getAppointmentStatus);
router.patch("/:id/patient-update", updatePatientAppointment);
router.patch("/:id/cancel", cancelAppointment);
router.patch("/:id", updateAppointment);

export default router;
