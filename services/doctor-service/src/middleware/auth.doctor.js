import jwt from 'jsonwebtoken';

export const authDoctor = async (req, res, next) => {
  try {
    const dtoken = req.headers.dtoken;
    if (!dtoken) {
      return res.json({ success: false, message: 'Not Authorized Login Again' });
    }

    const tokenDecode = jwt.verify(dtoken, process.env.JWT_SECRET);
    if (!tokenDecode?.id) {
      return res.json({ success: false, message: 'Invalid doctor token' });
    }

    req.doctorId = tokenDecode.id;
    next();
  } catch (error) {
    console.log(error);
    return res.json({ success: false, message: error.message });
  }
};
