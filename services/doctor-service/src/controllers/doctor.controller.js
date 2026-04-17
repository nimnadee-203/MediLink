import doctorModel from "../models/Doctor.js";
import mongoose from "mongoose";
import patientLookupModel from "../models/PatientLookup.js";
import prescriptionModel from "../models/Prescription.js";
import { sendNotificationToUser } from "../lib/notificationClient.js";
import axios from "axios";

const APPOINTMENT_SERVICE_URL = process.env.APPOINTMENT_SERVICE_URL || "http://localhost:8004";
const PATIENT_SERVICE_URL = process.env.PATIENT_SERVICE_URL || "http://localhost:8002";

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

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value));

export const getDoctorCompletedAppointments = async (req, res) => {
	try {
		const doctorId = req.doctorId;
		const { dtoken } = req.headers;

		const appointmentsRes = await axios
			.get(`${APPOINTMENT_SERVICE_URL}/api/appointments?doctorId=${doctorId}&status=completed`, {
				headers: { dtoken }
			})
			.catch((err) => {
				console.error("Failed to fetch completed appointments:", err.message);
				return { data: { appointments: [] } };
			});

		const appointments = appointmentsRes.data?.appointments || [];
		const sorted = [...appointments].sort((a, b) => {
			const ta = new Date(`${a.slotDate}T${a.slotTime || "00:00"}:00`).getTime();
			const tb = new Date(`${b.slotDate}T${b.slotTime || "00:00"}:00`).getTime();
			return tb - ta;
		});

		const uniquePatientIds = [...new Set(sorted.map((a) => String(a.patientId)))];
		const nameEntries = await Promise.all(
			uniquePatientIds.map(async (pid) => {
				const patientRes = await axios.get(`${PATIENT_SERVICE_URL}/api/patients/${pid}`).catch(() => ({ data: null }));
				return [pid, patientRes.data?.name || "Patient"];
			})
		);
		const patientNameMap = Object.fromEntries(nameEntries);

		return res.json({
			success: true,
			completedAppointments: sorted.map((appointment) => ({
				_id: String(appointment.id || appointment._id),
				patientId: String(appointment.patientId),
				patientName: patientNameMap[String(appointment.patientId)] || "Patient",
				slotDate: appointment.slotDate,
				slotTime: appointment.slotTime,
				reason: appointment.reason || "",
				visitMode: appointment.visitMode === "telemedicine" ? "telemedicine" : "in_person",
				status: appointment.status,
				paymentStatus: appointment.paymentStatus,
				amount: appointment.amount
			}))
		});
	} catch (error) {
		console.log(error);
		return res.json({ success: false, message: error.message });
	}
};

export const listPrescriptionsForAppointment = async (req, res) => {
	try {
		const { appointmentId } = req.query;
		const { dtoken } = req.headers;
		const doctorId = req.doctorId;

		if (!appointmentId || !isValidObjectId(appointmentId)) {
			return res.json({ success: false, message: "Valid appointmentId is required" });
		}

		const appointmentRes = await axios.get(`${APPOINTMENT_SERVICE_URL}/api/appointments/${appointmentId}`, {
			headers: { dtoken }
		});

		if (!appointmentRes.data?.appointment) {
			return res.json({ success: false, message: "Appointment not found" });
		}

		const appointment = appointmentRes.data.appointment;
		if (String(appointment.doctorId) !== String(doctorId)) {
			return res.json({ success: false, message: "Not authorized for this appointment" });
		}

		const items = await prescriptionModel
			.find({ doctorId, appointmentId })
			.sort({ createdAt: -1 })
			.lean();

		return res.json({
			success: true,
			prescriptions: items.map((p) => ({
				_id: String(p._id),
				appointmentId: String(p.appointmentId),
				patientId: String(p.patientId),
				medications: p.medications || [],
				generalInstructions: p.generalInstructions || "",
				createdAt: p.createdAt,
				updatedAt: p.updatedAt
			}))
		});
	} catch (error) {
		console.log(error);
		return res.json({ success: false, message: error.response?.data?.message || error.message });
	}
};

export const listPrescriptionsForPatient = async (req, res) => {
	try {
		const { patientId } = req.query;

		if (!patientId || !isValidObjectId(patientId)) {
			return res.json({ success: false, message: "Valid patientId is required" });
		}

		const items = await prescriptionModel
			.find({ patientId })
			.sort({ createdAt: -1 })
			.lean();

		if (items.length === 0) {
			return res.json({ success: true, prescriptions: [] });
		}

		const doctorIds = [...new Set(items.map((p) => String(p.doctorId)))];
		const doctors = await doctorModel
			.find({ _id: { $in: doctorIds } })
			.select("name speciality")
			.lean();
		const doctorMap = Object.fromEntries(
			doctors.map((doc) => [String(doc._id), { name: doc.name || "Doctor", speciality: doc.speciality || "" }])
		);

		const appointmentIds = [...new Set(items.map((p) => String(p.appointmentId)))];
		const appointmentDetails = {};

		await Promise.all(
			appointmentIds.map(async (id) => {
				const response = await axios
					.get(`${APPOINTMENT_SERVICE_URL}/api/appointments/${id}`)
					.catch(() => null);
				if (response?.data?.appointment) {
					appointmentDetails[id] = response.data.appointment;
				}
			})
		);

		const prescriptions = items.map((p) => {
			const doctorInfo = doctorMap[String(p.doctorId)] || { name: "Doctor", speciality: "" };
			const appt = appointmentDetails[String(p.appointmentId)] || {};

			return {
				_id: String(p._id),
				doctorId: String(p.doctorId),
				doctorName: doctorInfo.name,
				doctorSpeciality: doctorInfo.speciality,
				appointmentId: String(p.appointmentId),
				slotDate: appt.slotDate || null,
				slotTime: appt.slotTime || null,
				visitMode: appt.visitMode || null,
				reason: appt.reason || "",
				medications: p.medications || [],
				generalInstructions: p.generalInstructions || "",
				createdAt: p.createdAt,
				updatedAt: p.updatedAt
			};
		});

		return res.json({ success: true, prescriptions });
	} catch (error) {
		console.log(error);
		return res.json({ success: false, message: error.response?.data?.message || error.message });
	}
};

export const createDoctorPrescription = async (req, res) => {
	try {
		const doctorId = req.doctorId;
		const { dtoken } = req.headers;
		const { appointmentId, medications, generalInstructions } = req.body;

		if (!appointmentId || !isValidObjectId(appointmentId)) {
			return res.json({ success: false, message: "Valid appointmentId is required" });
		}

		if (!Array.isArray(medications) || medications.length === 0) {
			return res.json({ success: false, message: "Add at least one medication line" });
		}

		const appointmentRes = await axios.get(`${APPOINTMENT_SERVICE_URL}/api/appointments/${appointmentId}`, {
			headers: { dtoken }
		});

		if (!appointmentRes.data?.appointment) {
			return res.json({ success: false, message: "Appointment not found" });
		}

		const appointment = appointmentRes.data.appointment;
		if (String(appointment.doctorId) !== String(doctorId)) {
			return res.json({ success: false, message: "Not authorized for this appointment" });
		}

		if (appointment.status !== "completed") {
			return res.json({
				success: false,
				message: "Prescriptions can only be recorded for appointments marked completed"
			});
		}

		const normalizedMeds = medications
			.map((m) => ({
				drugName: String(m.drugName || "").trim(),
				dosage: String(m.dosage || "").trim(),
				frequency: String(m.frequency || "").trim(),
				duration: String(m.duration || "").trim(),
				notes: String(m.notes || "").trim()
			}))
			.filter((m) => m.drugName.length > 0);

		if (normalizedMeds.length === 0) {
			return res.json({ success: false, message: "Each medication needs a drug name" });
		}

		const created = await prescriptionModel.create({
			doctorId,
			patientId: appointment.patientId,
			appointmentId,
			medications: normalizedMeds,
			generalInstructions: String(generalInstructions || "").trim()
		});

		return res.json({
			success: true,
			message: "Prescription saved",
			prescription: {
				_id: String(created._id),
				appointmentId: String(created.appointmentId),
				patientId: String(created.patientId),
				medications: created.medications,
				generalInstructions: created.generalInstructions || "",
				createdAt: created.createdAt,
				updatedAt: created.updatedAt
			}
		});
	} catch (error) {
		console.log(error);
		return res.json({ success: false, message: error.response?.data?.message || error.message });
	}
};

export const getDoctorUpcomingAppointments = async (req, res) => {
	try {
		const doctorId = req.doctorId;
		const { dtoken } = req.headers;

		const doctor = await doctorModel.findById(doctorId).select("name speciality image");
		if (!doctor) {
			return res.json({ success: false, message: "Doctor not found" });
		}

		// Fetch all appointments for this doctor via appointment-service API
		const appointmentsRes = await axios.get(`${APPOINTMENT_SERVICE_URL}/api/appointments?doctorId=${doctorId}`, {
			headers: { dtoken }
		}).catch(err => {
			console.error("Failed to fetch appointments from service:", err.message);
			return { data: { appointments: [] } };
		});

		const appointments = appointmentsRes.data?.appointments || [];

		const now = Date.now();
		const today = new Date().toISOString().split("T")[0];
		const toTime = (appointment) => new Date(`${appointment.slotDate}T${appointment.slotTime || "00:00"}:00`).getTime();

		const upcomingAppointments = appointments
			.filter((appointment) => ["pending", "confirmed"].includes(appointment.status) && toTime(appointment) >= now)
			.slice(0, 10);

		// Extract patient names if we have them in the response, else lookup locally
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
				_id: String(appointment.id || appointment._id),
				patientId: String(appointment.patientId),
				patientName: appointment.patientName || "Patient",
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
		const { dtoken } = req.headers;

		// Fetch appointment basics from appointment-service
		const appointmentRes = await axios.get(`${APPOINTMENT_SERVICE_URL}/api/appointments/${appointmentId}`, {
			headers: { dtoken }
		});

		if (!appointmentRes.data?.appointment) {
			return res.json({ success: false, message: "Appointment not found" });
		}

		const appointment = appointmentRes.data.appointment;

		// Verify this doctor is the one assigned
		if (String(appointment.doctorId) !== String(req.doctorId)) {
			return res.json({ success: false, message: "Not authorized for this appointment" });
		}

		// Fetch basic patient details from patient-service
		const patientRes = await axios.get(`${PATIENT_SERVICE_URL}/api/patients/${appointment.patientId}`).catch(() => ({ data: null }));
		const patientBasic = patientRes.data;

		// Fetch extended patient details locally for reports (since doctor-service has the patient-lookup logic)
		const patientLookup = await patientLookupModel
			.findById(appointment.patientId)
			.select("name email reports")
			.lean();

		const selectedReportIdSet = new Set((appointment.reportIds || []).map((id) => reportIdKey(id)).filter(Boolean));
		const attachedReports = Array.isArray(patientLookup?.reports)
			? patientLookup.reports
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
				...appointment,
				_id: String(appointment.id || appointment._id),
				patientName: patientBasic?.name || patientLookup?.name || "Patient",
				patientEmail: patientBasic?.email || patientLookup?.email || "",
				reports: attachedReports
			}
		});
	} catch (error) {
		console.log(error);
		return res.json({ success: false, message: error.response?.data?.message || error.message });
	}
};

export const approveDoctorAppointment = async (req, res) => {
	try {
		const { appointmentId } = req.params;
		const { dtoken } = req.headers;

		const response = await axios.patch(`${APPOINTMENT_SERVICE_URL}/api/appointments/${appointmentId}`, {
			status: "confirmed"
		}, {
			headers: { dtoken }
		});

		if (!response.data?.appointment) {
			throw new Error("Update failed");
		}

		return res.json({ success: true, message: "Appointment approved", status: "confirmed" });
	} catch (error) {
		console.log(error);
		return res.json({ success: false, message: error.response?.data?.message || error.message });
	}
};

export const cancelDoctorAppointment = async (req, res) => {
	try {
		const { appointmentId } = req.params;
		const { dtoken } = req.headers;

		const response = await axios.patch(`${APPOINTMENT_SERVICE_URL}/api/appointments/${appointmentId}/cancel`, {
			cancelledBy: "doctor"
		}, {
			headers: { dtoken }
		});

		if (!response.data?.appointment) {
			throw new Error("Cancellation failed");
		}

		return res.json({ success: true, message: "Appointment cancelled", status: "cancelled" });
	} catch (error) {
		console.log(error);
		return res.json({ success: false, message: error.response?.data?.message || error.message });
	}
};

export const completeDoctorAppointment = async (req, res) => {
	try {
		const { appointmentId } = req.params;
		const { dtoken } = req.headers;

		const response = await axios.patch(
			`${APPOINTMENT_SERVICE_URL}/api/appointments/${appointmentId}`,
			{ status: "completed" },
			{ headers: { dtoken } }
		);

		if (!response.data?.appointment) {
			throw new Error("Completion failed");
		}

		return res.json({ success: true, message: "Appointment marked as completed", status: "completed" });
	} catch (error) {
		console.log(error);
		return res.json({ success: false, message: error.response?.data?.message || error.message });
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

