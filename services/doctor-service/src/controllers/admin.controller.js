import mockUsers from "../../mocks/users.mock.js";
import mockAppointments from "../../mocks/appoiments.mock.js";
import doctorModel from "../models/Doctor.js"
import userModel from "../models/User_test.js"
import appoimentModel from "../models/Appoiment_test.js"
import validator from "validator"
import bcrypt, { hash } from 'bcrypt'
import {v2 as cloudinary} from 'cloudinary'
import jwt from 'jsonwebtoken'
import axios from 'axios'
import { createClerkClient } from '@clerk/backend'

const getClerkClient = () => {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey || /replace_with/i.test(secretKey)) {
        return null;
    }

    return createClerkClient({ secretKey });
};

const splitName = (fullName = '') => {
    const normalized = String(fullName).trim().replace(/\s+/g, ' ');
    if (!normalized) {
        return { firstName: 'Doctor', lastName: undefined };
    }

    const [firstName, ...rest] = normalized.split(' ');
    return {
        firstName,
        lastName: rest.length ? rest.join(' ') : undefined
    };
};

const normalizeClerkUsername = (value = '') => {
    let username = String(value || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
    if (!username) {
        username = `doctor_${Math.random().toString(36).slice(2, 8)}`;
    }

    if (!/^[a-z]/.test(username)) {
        username = `d${username}`;
    }

    if (username.length < 3) {
        username = `${username}${Math.random().toString(36).slice(2, 6)}`;
    }

    return username.slice(0, 32);
};

const extractClerkErrorText = (error) =>
    error?.errors?.map((item) => `${item?.code || ''}:${item?.longMessage || item?.message || ''}`).join(' | ') ||
    error?.message ||
    '';

const hasUsernameRequirementError = (error) => /username|already taken|identifier exists/i.test(extractClerkErrorText(error));

const buildUsernameCandidates = (email = '') => {
    const base = normalizeClerkUsername(String(email || '').split('@')[0]);
    const compact = base.replace(/[^a-z0-9]/g, '').slice(0, 24) || `doctor${Math.random().toString(36).slice(2, 7)}`;
    const randomSuffix = () => Math.random().toString(36).slice(2, 6);

    return Array.from(new Set([
        base,
        compact,
        `${base.slice(0, 26)}_${randomSuffix()}`,
        `doctor_${randomSuffix()}${randomSuffix()}`
    ]));
};

const ensureDoctorClerkAccount = async ({ name, email, password }) => {
    const clerkClient = getClerkClient();
    if (!clerkClient) {
        throw new Error('CLERK_SECRET_KEY is not configured for doctor-service');
    }

    const { firstName, lastName } = splitName(name);
    const usernameCandidates = buildUsernameCandidates(email);

    const listResult = await clerkClient.users.getUserList({
        emailAddress: [email],
        limit: 1
    });

    const existing = Array.isArray(listResult?.data) ? listResult.data[0] : null;

    if (existing) {
        let updated = false;

        for (const username of usernameCandidates) {
            try {
                await clerkClient.users.updateUser(existing.id, {
                    password,
                    firstName,
                    lastName,
                    username,
                    publicMetadata: { role: 'doctor' }
                });
                updated = true;
                break;
            } catch (error) {
                if (!hasUsernameRequirementError(error)) {
                    throw error;
                }
            }
        }

        if (!updated) {
            await clerkClient.users.updateUser(existing.id, {
                password,
                firstName,
                lastName,
                publicMetadata: { role: 'doctor' }
            });
        }

        return { clerkUserId: existing.id, created: false };
    }

    let created = null;
    let lastError = null;

    for (const username of usernameCandidates) {
        try {
            created = await clerkClient.users.createUser({
                emailAddress: [email],
                password,
                firstName,
                lastName,
                username,
                publicMetadata: { role: 'doctor' }
            });
            break;
        } catch (error) {
            lastError = error;
            if (!hasUsernameRequirementError(error)) {
                throw error;
            }
        }
    }

    if (!created) {
        try {
            created = await clerkClient.users.createUser({
                emailAddress: [email],
                password,
                firstName,
                lastName,
                publicMetadata: { role: 'doctor' }
            });
        } catch (error) {
            throw lastError || error;
        }
    }

    return { clerkUserId: created.id, created: true };
};

//API for adding doctor
export const addDoctor = async (req, res)=>{
    try{
        
        const {name,email,password,speciality,degree,experience,about,available,fees,address,status,consultationMode} = req.body;
        const imageFile = req.file
        const normalizedEmail = (email || '').trim().toLowerCase();
        const normalizedPassword = (password || '').trim();
        const parsedAvailable = available === 'true' || available === true;

        // console.log({name,email,password,speciality,degree,experience,about,available,fees,address,status},imageFile)

        //checking for all data to add doctor
        if(!name || !normalizedEmail || !normalizedPassword || !speciality || !degree || !experience || !about || !fees || !address || !status || !imageFile){
            return res.json({success:false,message:"Missing Details"})
        }

        //Validating email format 
        if(!validator.isEmail(normalizedEmail)){
            return res.json({success:false,message:"Please enter valid email"})
        }

        //Validating strong password
        if(normalizedPassword.length < 8){
            return res.json({success:false,message:"Please enter strong password"})

        }

        //hashing doctor password
        const salt =  await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(normalizedPassword,salt)

        const existingDoctor = await doctorModel.findOne({ email: normalizedEmail }).select('_id');
        if (existingDoctor) {
            return res.json({ success: false, message: 'Doctor with this email already exists' });
        }

        let clerkSync;
        try {
            clerkSync = await ensureDoctorClerkAccount({
                name,
                email: normalizedEmail,
                password: normalizedPassword
            });
        } catch (clerkError) {
            const status = Number(clerkError?.status || clerkError?.statusCode || 500);
            const message = clerkError?.errors?.[0]?.longMessage ||
                clerkError?.errors?.[0]?.message ||
                extractClerkErrorText(clerkError) ||
                'Failed to create doctor login in Clerk';
            return res.status(status >= 400 && status < 500 ? status : 500).json({ success: false, message });
        }

        //Upload image to cloudinary
        const imageUpload = await cloudinary.uploader.upload(imageFile.path,{resource_type:"image"})
        const imageUrl = imageUpload.secure_url

       

        const doctorData = {
            name,
            email: normalizedEmail,
            clerkUserId: clerkSync.clerkUserId,
            image:imageUrl,
            password:hashedPassword,
            speciality,
            degree,
            experience,
            about,
            consultationMode: consultationMode === 'both' ? 'both' : 'in_person_only',
            available: parsedAvailable,
            fees,
            address:address,
            status: status || 'approved',
            date:Date.now()
        }

        const newDoctor = new doctorModel(doctorData)
        try {
            await newDoctor.save()
        } catch (saveError) {
            if (clerkSync.created) {
                try {
                    const clerkClient = getClerkClient();
                    if (clerkClient) {
                        await clerkClient.users.deleteUser(clerkSync.clerkUserId);
                    }
                } catch {
                }
            }
            throw saveError;
        }

        res.json({success:true,message:"Doctor Added"})


    }catch(error){
        console.log(error)
        res.json({success:false,message:error.message})
    }
}

//API for admin logn
export const loginAdmin = async (req,res)=>{
    try{
        const {email,password} = req.body;

        if(email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD){

            const token = jwt.sign(email+password,process.env.JWT_SECRET)
            res.json({success:true,token})

        }else{
            res.json({success:false,message:"Invalid credentials"})
        }

    }catch(error){
        console.log(error)
        res.json({success:false,message:error.message})

    }
}

//API for doctor login
export const loginDoctor = async (req, res) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = (email || '').trim().toLowerCase();
        const normalizedPassword = (password || '').trim();

        if (!normalizedEmail || !normalizedPassword) {
            return res.json({ success: false, message: "Email and password are required" });
        }

        const doctor = await doctorModel.findOne({ email: normalizedEmail });
        if (!doctor) {
            return res.json({ success: false, message: "Invalid credentials" });
        }

        let isMatch = false;
        const storedPassword = String(doctor.password || '');

        if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2y$')) {
            isMatch = await bcrypt.compare(normalizedPassword, storedPassword);
        } else {
            // Backward compatibility for legacy plaintext passwords in existing test data.
            isMatch = normalizedPassword === storedPassword;
            if (isMatch) {
                const salt = await bcrypt.genSalt(10);
                doctor.password = await bcrypt.hash(normalizedPassword, salt);
                await doctor.save();
            }
        }

        if (!isMatch) {
            return res.json({ success: false, message: "Invalid credentials" });
        }

        const token = jwt.sign({ id: doctor._id, role: 'doctor' }, process.env.JWT_SECRET);
        return res.json({ success: true, token, message: "Doctor logged in successfully" });
    } catch (error) {
        console.log(error);
        return res.json({ success: false, message: error.message });
    }
}





//API to get dashboard data for admin panel
export const adminDashboard = async (req,res)=>{
    try{
        const { atoken } = req.headers;

        // Fetch local doctors count from the 'doctors' database
        const doctorsCount = await doctorModel.countDocuments({});

        // Fetch patients from patient-service (Port 8002)
        // Note: We pass the admin token for authorization
        const patientsRes = await axios.get('http://localhost:8002/api/patients/admin/users', { 
            headers: { atoken } 
        }).catch(() => ({ data: { users: [] } }));
        const patientsCount = patientsRes.data?.users?.length || 0;

        // Fetch appointments from appointment-service (Port 8004)
        // The service already returns an 'appointments' array and a 'count'
        const appointmentsRes = await axios.get('http://localhost:8004/api/appointments', { 
            headers: { atoken } 
        }).catch(() => ({ data: { appointments: [] } }));
        
        const appointments = appointmentsRes.data?.appointments || [];
        const appointmentsCount = appointmentsRes.data?.count || appointments.length;

        const dashData = {
            doctors: doctorsCount,
            appoiments: appointmentsCount,
            patients: patientsCount,
            latestAppoiments: appointments.slice(0, 5)
        }

        res.json({success:true,dashData})

    }catch(error){
        console.log("Dashboard aggregation failed:", error.message)
        res.json({success:false,message:error.message})
    }
}

// API to get all doctors list for admin panel
export const allDoctors = async (req,res) => {
    try {
        const doctors = await doctorModel.find({}).select('-password')
        res.json({success:true,doctors})

    } catch (error) {
        console.log(error)
        res.json({success:false,message:error.message})
    }
}

// API to change doctor availability for admin panel
export const changeAvailability = async (req,res) => {
    try {
        const {docId} = req.body
        const docData = await doctorModel.findById(docId)
        await doctorModel.findByIdAndUpdate(docId,{available: !docData.available})
        res.json({success:true, message: 'Availability Changed'})

    } catch (error) {
        console.log(error)
        res.json({success:false,message:error.message})
    }
}

// API to update doctor details (excluding password)
export const updateDoctor = async (req, res) => {
    try {
        const { docId, name, speciality, degree, experience, about, fees, address, status, available, consultationMode } = req.body
        const imageFile = req.file

        const updateData = {
            name,
            speciality,
            degree,
            experience,
            about,
            fees,
            address,
            status,
            available: available === 'true' || available === true,
            consultationMode: consultationMode === 'both' ? 'both' : 'in_person_only'
        }

        if (imageFile) {
            const imageUpload = await cloudinary.uploader.upload(imageFile.path, { resource_type: "image" })
            updateData.image = imageUpload.secure_url
        }

        await doctorModel.findByIdAndUpdate(docId, updateData)
        res.json({ success: true, message: "Doctor Updated Successfully" })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to delete a doctor
export const deleteDoctor = async (req, res) => {
    try {
        const { docId } = req.body
        await doctorModel.findByIdAndDelete(docId)
        res.json({ success: true, message: "Doctor Deleted Successfully" })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}



