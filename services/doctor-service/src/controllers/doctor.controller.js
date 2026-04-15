import doctorModel from "../models/Doctor.js";
import appointmentReadModel from "../models/AppointmentRead.js";
import mongoose from "mongoose";
import patientLookupModel from "../models/PatientLookup.js";
import { sendNotificationToUser } from "../lib/notificationClient.js";

const doctorProjection =
	"name email image speciality degree experience about consultationMode available fees address slots_booked status";

const reportIdKey = (value) => {
	if (value == null || value === "") return "";
	try {
		return new mongoose.Types.ObjectId(value).toHexString();
	} catch {
		return String(value);
	}
};

const normalizeDoctor = (doctor) => ({
	_id: String(doctor._id),
	name: doctor.name || "",
	image: doctor.image || "",
	speciality: doctor.speciality || "General Physician",
	degree: doctor.degree || "",
	experience: doctor.experience || "",
	about: doctor.about || "",
	consultationMode: doctor.consultationMode || "in_person_only",
	available: typeof doctor.available === "boolean" ? doctor.available : true,
	fees: Number.isFinite(Number(doctor.fees)) ? Number(doctor.fees) : 0,
	address: doctor.address || "",
	email: doctor.email || "",
	slots_booked: doctor.slots_booked || {},
	status: doctor.status || "approved"
});

// Public API for patient app doctor directory
export const listDoctors = async (_req, res) => {
	try {
		const doctors = await doctorModel
			.find({ status: { $ne: "rejected" }, available: true })
			.select(doctorProjection)
			.lean();

		return res.json({
			success: true,
			doctors: doctors.map(normalizeDoctor)
		});
	} catch (error) {
		console.log(error);
		return res.status(500).json({ success: false, message: error.message });
	}
};

// Public API for booking/details pages
export const getDoctorById = async (req, res) => {
	try {
		const { doctorId } = req.params;
		const doctor = await doctorModel.findById(doctorId).select(doctorProjection).lean();

		if (!doctor || doctor.status === "rejected" || doctor.available === false) {
			return res.status(404).json({ success: false, message: "Doctor not found" });
		}

		return res.json({ success: true, doctor: normalizeDoctor(doctor) });
	} catch (error) {
		console.log(error);
		return res.status(500).json({ success: false, message: error.message });
	}
};

export const getDoctorUpcomingAppointments = async (req, res) => {
	try {
		const doctorId = req.doctorId;
		const doctor = await doctorModel.findById(doctorId).select("name speciality image");
		if (!doctor) {
			return res.json({ success: false, message: "Doctor not found" });
		}

		const appointments = await appointmentReadModel.find({ doctorId }).sort({ slotDate: 1, slotTime: 1, createdAt: -1 });

		const now = Date.now();
		const today = new Date().toISOString().split("T")[0];
		const toTime = (appointment) => new Date(`${appointment.slotDate}T${appointment.slotTime || "00:00"}:00`).getTime();

		const upcomingAppointments = appointments
			.filter((appointment) => ["pending", "confirmed"].includes(appointment.status) && toTime(appointment) >= now)
			.slice(0, 10);

		const patientIds = [...new Set(upcomingAppointments.map((item) => String(item.patientId)).filter(Boolean))];
		const patients = await patientLookupModel.find({ _id: { $in: patientIds } }).select("name email").lean();
		const patientMap = new Map(patients.map((patient) => [String(patient._id), patient]));

		const stats = {
			todayAppointments: appointments.filter((appointment) => appointment.slotDate === today && appointment.status !== "cancelled").length,
			pendingAppointments: appointments.filter((appointment) => appointment.status === "pending").length,
			completedToday: appointments.filter((appointment) => appointment.slotDate === today && appointment.status === "completed").length
		};

		return res.json({
			success: true,
			doctor: {
				_id: String(doctor._id),
				name: doctor.name || "",
				speciality: doctor.speciality || "General Physician",
				image: doctor.image || ""
			},
			stats,
			upcomingAppointments: upcomingAppointments.map((appointment) => ({
				_id: String(appointment._id),
				patientId: String(appointment.patientId),
				patientName: patientMap.get(String(appointment.patientId))?.name || "Patient",
				slotDate: appointment.slotDate,
				slotTime: appointment.slotTime,
				reason: appointment.reason || "",
				visitMode: appointment.visitMode === "telemedicine" ? "telemedicine" : "in_person",
				status: appointment.status,
				paymentStatus: appointment.paymentStatus,
				amount: appointment.amount,
				reportIds: (appointment.reportIds || []).map((id) => String(id))
			}))
		});
	} catch (error) {
		console.log(error);
		return res.json({ success: false, message: error.message });
	}
};

export const getDoctorAppointmentDetails = async (req, res) => {
	try {
		const { appointmentId } = req.params;
		if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
			return res.json({ success: false, message: "Invalid appointment id" });
		}

		const appointment = await appointmentReadModel.findById(appointmentId).lean();
		if (!appointment) {
			return res.json({ success: false, message: "Appointment not found" });
		}

		if (String(appointment.doctorId) !== String(req.doctorId)) {
			return res.json({ success: false, message: "Not authorized for this appointment" });
		}

		const patient = await patientLookupModel
			.findById(appointment.patientId)
			.select("name email reports")
			.lean();

		const selectedReportIdSet = new Set((appointment.reportIds || []).map((id) => reportIdKey(id)).filter(Boolean));
		const attachedReports = Array.isArray(patient?.reports)
			? patient.reports
					.filter((report) => report?._id != null && selectedReportIdSet.has(reportIdKey(report._id)))
					.map((report) => ({
						id: String(report._id),
						title: report.title || report.fileName || "Report",
						description: report.description || "",
						fileName: report.fileName || "",
						filePath: report.filePath || "",
						mimeType: report.mimeType || "",
						size: Number(report.size) || 0,
						uploadedAt: report.uploadedAt || null
					}))
			: [];

		return res.json({
			success: true,
			appointment: {
				_id: String(appointment._id),
				patientId: String(appointment.patientId),
				patientName: patient?.name || "Patient",
				patientEmail: patient?.email || "",
				doctorId: String(appointment.doctorId),
				slotDate: appointment.slotDate,
				slotTime: appointment.slotTime,
				amount: appointment.amount,
				reason: appointment.reason || "",
				visitMode: appointment.visitMode === "telemedicine" ? "telemedicine" : "in_person",
				status: appointment.status,
				paymentStatus: appointment.paymentStatus,
				reportIds: (appointment.reportIds || []).map((id) => String(id)),
				reports: attachedReports,
				createdAt: appointment.createdAt,
				updatedAt: appointment.updatedAt
			}
		});
	} catch (error) {
		console.log(error);
		return res.json({ success: false, message: error.message });
	}
};

export const approveDoctorAppointment = async (req, res) => {
	try {
		const { appointmentId } = req.params;
		if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
			return res.json({ success: false, message: "Invalid appointment id" });
		}

		const appointment = await appointmentReadModel.findById(appointmentId).lean();
		if (!appointment) {
			return res.json({ success: false, message: "Appointment not found" });
		}

		if (String(appointment.doctorId) !== String(req.doctorId)) {
			return res.json({ success: false, message: "Not authorized for this appointment" });
		}

		if (appointment.status === "cancelled" || appointment.status === "completed") {
			return res.json({ success: false, message: `Cannot approve an appointment with status "${appointment.status}"` });
		}

		if (appointment.status === "confirmed") {
			return res.json({ success: false, message: "Appointment is already confirmed" });
		}

		// updateOne avoids full-document save() issues (e.g. legacy / mixed shapes in appointment-db).
		const result = await appointmentReadModel.updateOne(
			{ _id: appointmentId },
			{ $set: { status: "confirmed" } }
		);

		if (result.matchedCount === 0) {
			return res.json({ success: false, message: "Appointment not found" });
		}

		const doctor = await doctorModel.findById(req.doctorId).select("name").lean();
		const rawName = (doctor?.name || "").replace(/^dr\.?\s+/i, "").trim();
		const doctorLabel = rawName ? `Dr. ${rawName}` : "Your clinician";

		await sendNotificationToUser({
			recipientId: appointment.patientId,
			recipientRole: "patient",
			type: "appointment_confirmed",
			title: "Appointment confirmed",
			body: `Your visit on ${appointment.slotDate} at ${appointment.slotTime} was confirmed by ${doctorLabel}.`,
			appointmentId
		});

		return res.json({ success: true, message: "Appointment approved", status: "confirmed" });
	} catch (error) {
		console.log(error);
		return res.json({ success: false, message: error.message });
	}
};

export const cancelDoctorAppointment = async (req, res) => {
	try {
		const { appointmentId } = req.params;
		if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
			return res.json({ success: false, message: "Invalid appointment id" });
		}

		const appointment = await appointmentReadModel.findById(appointmentId).lean();
		if (!appointment) {
			return res.json({ success: false, message: "Appointment not found" });
		}

		if (String(appointment.doctorId) !== String(req.doctorId)) {
			return res.json({ success: false, message: "Not authorized for this appointment" });
		}

		if (appointment.status === "cancelled") {
			return res.json({ success: false, message: "Appointment already cancelled" });
		}
		if (appointment.status === "completed") {
			return res.json({ success: false, message: "Completed appointments cannot be cancelled" });
		}

		const result = await appointmentReadModel.updateOne(
			{ _id: appointmentId },
			{ $set: { status: "cancelled" } }
		);

		if (result.matchedCount === 0) {
			return res.json({ success: false, message: "Appointment not found" });
		}

		await sendNotificationToUser({
			recipientId: appointment.patientId,
			recipientRole: "patient",
			type: "appointment_cancelled_clinic",
			title: "Appointment cancelled",
			body: `Your visit on ${appointment.slotDate} at ${appointment.slotTime} was cancelled by the clinic.`,
			appointmentId
		});

		return res.json({ success: true, message: "Appointment cancelled", status: "cancelled" });
	} catch (error) {
		console.log(error);
		return res.json({ success: false, message: error.message });
	}
};

export const getDoctorEmail = async (req, res) => {
	try {
		const { doctorId } = req.params;
		const doctor = await doctorModel.findById(doctorId).select("email").lean();

		if (!doctor) {
			return res.status(404).json({ success: false, message: "Doctor not found" });
		}

		return res.json({ success: true, email: doctor.email });
	} catch (error) {
		return res.status(500).json({ success: false, message: error.message });
	}
};

