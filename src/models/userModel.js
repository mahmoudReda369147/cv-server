// src/models/userModel.js
const prisma = require('../config/database');
const bcrypt = require('bcryptjs');

const userModel = {
  // Create a new user
  async create(userData) {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    return prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword
      }
    });
  },

  // Find user by email
  async findByEmail(email) {
    return prisma.user.findUnique({
      where: { email }
    });
  },

  // Find user by ID
  async findById(id) {
    return prisma.user.findUnique({
      where: { id }
    });
  },

  // Validate user password
  async validatePassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
};

module.exports = userModel;