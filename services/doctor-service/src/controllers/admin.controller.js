import mockUsers from "../../mocks/users.mock.js";
import mockAppointments from "../../mocks/appoiments.mock.js";
import doctorModel from "../models/Doctor.js"
import userModel from "../models/User_test.js"
import appoimentModel from "../models/Appoiment_test.js"
import validator from "validator"
import bcrypt, { hash } from 'bcrypt'
import {v2 as cloudinary} from 'cloudinary'

//API for adding doctor
export const addDoctor = async (req, res)=>{
    try{
        
        const {name,email,password,speciality,degree,experience,about,available,fees,address,status} = req.body;
        const imageFile = req.file

        // console.log({name,email,password,speciality,degree,experience,about,available,fees,address,status},imageFile)

        //checking for all data to add doctor
        if(!name || !email || !password || !speciality || !degree || !experience || !about || !fees || !address || !status || !imageFile){
            return res.json({success:false,message:"Missing Details"})
        }

        //Validating email format 
        if(!validator.isEmail(email)){
            return res.json({success:false,message:"Please enter valid email"})
        }

        //Validating strong password
        if(password.length < 8){
            return res.json({success:false,message:"Please enter strong password"})

        }

        //hashing doctor password
        const salt =  await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password,salt)

        //Upload image to cloudinary
        const imageUpload = await cloudinary.uploader.upload(imageFile.path,{resource_type:"image"})
        const imageUrl = imageUpload.secure_url

        const doctorData = {
            name,
            email,
            image:imageUrl,
            password:hashedPassword,
            speciality,
            degree,
            experience,
            about,
            fees,
            address:JSON.parse(address),
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





//API to get dashboard data for admin panel
export const adminDashboard = async (req,res)=>{
    try{
        const doctors = await doctorModel.find({})
        const users = await userModel.find({})
        const appoiments = await appoimentModel.find({})

        const dashData = {
            doctors:doctors.length,
            appoiments:appoiments.length,
            patients:users.length,
            latestAppoiments: appoiments.reverse().slice(0,5)

        }

        res.json({success:true,dashData})

    }catch(error){
        console.log(error)
        res.json({success:false,message:error.message})
    }
}

