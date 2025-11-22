const { verifyToken } = require('../utils/jwt.util');
const User = require('../models/user.model');

const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        status: 'error',
        message: 'No token provided' 
      });
    }

    const token = authHeader.split('Bearer ')[1];
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ 
        status: 'error',
        message: 'User not found' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ 
      status: 'error',
      message: 'Invalid token' 
    });
  }
};

module.exports = { authenticateUser }; 