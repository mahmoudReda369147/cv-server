// src/server.js
const express = require('express');
const cors = require('cors');
const config = require('./config/config');
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');

const { GoogleGenerativeAI } = require('@google/generative-ai');
const puppeteer = require('puppeteer');
const JSON5 = require('json5');
const prisma = require('./config/database');

// Initialize Express app
const app = express();

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json());

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);


// Chat route (from original implementation)
// app.post("/api/chat", );


// Start server
const PORT = config.PORT || 3000;
 app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
