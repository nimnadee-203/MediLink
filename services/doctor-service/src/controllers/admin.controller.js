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

        //Upload image to cloudinary
        const imageUpload = await cloudinary.uploader.upload(imageFile.path,{resource_type:"image"})
        const imageUrl = imageUpload.secure_url

       

        const doctorData = {
            name,
            email: normalizedEmail,
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
        await newDoctor.save()

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



