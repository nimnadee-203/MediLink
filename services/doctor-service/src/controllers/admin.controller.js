import mockUsers from "../../mocks/users.mock.js";
import mockAppointments from "../../mocks/appoiments.mock.js";

//API to get dashboard data for admin panel
export const adminDashboard = async (req,res)=>{
    try{
        const doctors = await mockUsers.find({})
        const users = await mockUsers.find({})
        const appoiments = await mockAppointments.find({})

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