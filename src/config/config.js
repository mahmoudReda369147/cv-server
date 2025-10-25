// src/config/config.js
require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  SYSTEM_PROMPT: process.env.SYSTEM_PROMPT || 'أنت مساعد افتراضي مفيد.'
};