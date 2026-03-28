import jwt from 'jsonwebtoken'

//admin authentication middleware
export const authAdmin = async (req,res)=>{
    try{
        const {atoken} = req.headers
        if(!atoken){
            return res.json({success:false,message:"Not Authorized, Log again"})
        }
        const token_decode = jwt.verify(atoken,process.env.JWT_SECRET)

        if(token_decode !== process.env.ADMIN_EMAIL + process.env.ADMIN_PASSWORD){
            return res.json({success:false,message:"Not Authorized, Log again"})
        }

        next()

    }catch(error){
        console.log(error)
        res.json({success:false,message:error.message})
    }
}