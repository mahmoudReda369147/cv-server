// src/middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const prisma = require('../config/database');

const authMiddleware = async(req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, config.JWT_SECRET);
    
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Add user info to request
    req.user = user;
    console.log('Decoded token:', user);
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = { authMiddleware };