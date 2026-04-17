import doctorModel from "../models/Doctor.js";
import mongoose from "mongoose";
import patientLookupModel from "../models/PatientLookup.js";
import prescriptionModel from "../models/Prescription.js";
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

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value));

/* ===================== DOCTOR LIST ===================== */
export const listDoctors = async (_req, res) => {
  try {
    const doctors = await doctorModel
      .find({ status: { $ne: "rejected" }, available: true })
      .select(doctorProjection)
      .lean();

    return res.json({ success: true, doctors: doctors.map(normalizeDoctor) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getDoctorById = async (req, res) => {
  try {
    const doctor = await doctorModel.findById(req.params.doctorId).select(doctorProjection).lean();

    if (!doctor || doctor.status === "rejected" || doctor.available === false) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    return res.json({ success: true, doctor: normalizeDoctor(doctor) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* ===================== APPOINTMENTS ===================== */

export const getDoctorUpcomingAppointments = async (req, res) => {
  try {
    const doctorId = req.doctorId;
    const { dtoken } = req.headers;

    const doctor = await doctorModel.findById(doctorId).select("name speciality image");

    const { data } = await axios.get(
      `${APPOINTMENT_SERVICE_URL}/api/appointments?doctorId=${doctorId}`,
      { headers: { dtoken } }
    );

    const appointments = data?.appointments || [];
    const now = Date.now();

    const upcoming = appointments.filter(
      (a) =>
        ["pending", "confirmed"].includes(a.status) &&
        new Date(`${a.slotDate}T${a.slotTime}`).getTime() >= now
    );

    return res.json({
      success: true,
      doctor,
      upcomingAppointments: upcoming
    });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

export const getDoctorAppointmentDetails = async (req, res) => {
  try {
    const { dtoken } = req.headers;

    const { data } = await axios.get(
      `${APPOINTMENT_SERVICE_URL}/api/appointments/${req.params.appointmentId}`,
      { headers: { dtoken } }
    );

    const appointment = data?.appointment;
    if (!appointment) {
      return res.json({ success: false, message: "Appointment not found" });
    }

    return res.json({ success: true, appointment });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

/* ===================== ACTIONS ===================== */

export const approveDoctorAppointment = async (req, res) => {
  try {
    const { dtoken } = req.headers;

    const response = await axios.patch(
      `${APPOINTMENT_SERVICE_URL}/api/appointments/${req.params.appointmentId}`,
      { status: "confirmed" },
      { headers: { dtoken } }
    );

    if (!response.data?.appointment) throw new Error("Update failed");

    return res.json({ success: true, message: "Appointment approved" });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

export const cancelDoctorAppointment = async (req, res) => {
  try {
    const { dtoken } = req.headers;

    const response = await axios.patch(
      `${APPOINTMENT_SERVICE_URL}/api/appointments/${req.params.appointmentId}/cancel`,
      { cancelledBy: "doctor" },
      { headers: { dtoken } }
    );

    if (!response.data?.appointment) throw new Error("Cancellation failed");

    return res.json({ success: true, message: "Appointment cancelled" });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

export const completeDoctorAppointment = async (req, res) => {
  try {
    const { dtoken } = req.headers;

    const response = await axios.patch(
      `${APPOINTMENT_SERVICE_URL}/api/appointments/${req.params.appointmentId}`,
      { status: "completed" },
      { headers: { dtoken } }
    );

    if (!response.data?.appointment) throw new Error("Completion failed");

    return res.json({ success: true, message: "Appointment completed" });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

/* ===================== PRESCRIPTIONS ===================== */

export const createDoctorPrescription = async (req, res) => {
  try {
    const { appointmentId, medications } = req.body;

    if (!appointmentId || !isValidObjectId(appointmentId)) {
      return res.json({ success: false, message: "Invalid appointmentId" });
    }

    const created = await prescriptionModel.create({
      doctorId: req.doctorId,
      appointmentId,
      medications
    });

    return res.json({ success: true, prescription: created });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

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
        generalInstructions: p.generalInstructions || ""
      };
    });

    return res.json({ success: true, prescriptions });
  } catch (error) {
    console.log(error);
    return res.json({ success: false, message: error.message });
  }
};

/* ===================== EXTRA ===================== */

export const getDoctorEmail = async (req, res) => {
  try {
    const doctor = await doctorModel.findById(req.params.doctorId).select("email");
    if (!doctor) return res.status(404).json({ success: false });

    return res.json({ success: true, email: doctor.email });
  } catch (error) {
    return res.status(500).json({ success: false });
  }
};