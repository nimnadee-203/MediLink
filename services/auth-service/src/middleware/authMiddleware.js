const jwt = require('jsonwebtoken');

// This function returns the secret key used for JWT.
const getJwtSecret = () => process.env.JWT_SECRET || 'medisync_dev_secret';

//  Middleware runs before your route function.
//This gets the token from the request header.
const authenticateJwt = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization token is required' });
    }
    // Extract only the token part from the "Bearer <token>" string
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, getJwtSecret()); // This checks if the token is real and not expired.

    req.user = decoded;
    return next(); // Token is valid. Continue to the actual route.
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token', error: error.message });
  }
};

module.exports = {
  authenticateJwt,
  getJwtSecret
};
