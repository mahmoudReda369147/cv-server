// src/controllers/authController.js
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const config = require('../config/config');
const { sendResponse } = require('../utils/responseUtil');

const authController = {
  // Register a new user
  async register(req, res) {
    try {
      const { email, password, name } = req.body;
      
      // Check if user already exists
      const existingUser = await userModel.findByEmail(email);
      if (existingUser) {
        return sendResponse(res, false, 'User already exists with this email', null, 400);
      }
      
      // Create new user
      const user = await userModel.create({ email, password, name });
      
      // Generate JWT token
      const token = jwt.sign({ userId: user.id }, config.JWT_SECRET);
      
      // Return user data and token (excluding password)
      const { password: _, ...userData } = user;
      return sendResponse(res, true, 'User registered successfully', {
        user: userData,
        token
      }, 201);
    } catch (error) {
      console.error('Registration error:', error);
      return sendResponse(res, false, 'Registration failed: '+error.message, null, 500);
    }
  },
  
  // Login user
  async login(req, res) {
    try {
      const { email, password } = req.body;
      
      // Find user by email
      const user = await userModel.findByEmail(email);
      if (!user) {
        return sendResponse(res, false, 'Invalid credentials', null, 401);
      }
      
      // Validate password
      const isPasswordValid = await userModel.validatePassword(password, user.password);
      if (!isPasswordValid) {
        return sendResponse(res, false, 'Invalid credentials', null, 401);
      }
      
      // Generate JWT token
      const token = jwt.sign({ userId: user.id }, config.JWT_SECRET, {
        expiresIn: config.JWT_EXPIRES_IN
      });
      
      // Return user data and token (excluding password)
      const { password: _, ...userData } = user;
      return sendResponse(res, true, 'Login successful', {
        user: userData,
        token
      });
    } catch (error) {
      console.error('Login error:', error);
      return sendResponse(res, false, 'Login failed', null, 500);
    }
  },
  
  // Get current user profile
  async getProfile(req, res) {
    try {
      const userId = req.user.userId;
      const user = await userModel.findById(userId);
      
      if (!user) {
        return sendResponse(res, false, 'User not found', null, 404);
      }
      
      // Return user data (excluding password)
      const { password: _, ...userData } = user;
      return sendResponse(res, true, 'Profile retrieved successfully', { user: userData });
    } catch (error) {
      console.error('Get profile error:', error);
      return sendResponse(res, false, 'Failed to get user profile', null, 500);
    }
  }
};

module.exports = authController;