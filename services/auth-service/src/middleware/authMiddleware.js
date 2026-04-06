const jwt = require('jsonwebtoken');

const getJwtSecret = () => process.env.JWT_SECRET || 'medisync_dev_secret';

const authenticateJwt = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization token is required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, getJwtSecret());

    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token', error: error.message });
  }
};

module.exports = {
  authenticateJwt,
  getJwtSecret
};
