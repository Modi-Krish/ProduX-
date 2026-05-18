const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars from root .env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const connectDB = require('./config/db');
const errorHandler = require('./middlewares/errorHandler');
const initializeSocket = require('./socket');

// Route imports
const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const gamificationRoutes = require('./routes/gamificationRoutes');
const habitRoutes = require('./routes/habitRoutes');
const hobbyRoutes = require('./routes/hobbyRoutes');
const socialRoutes = require('./routes/socialRoutes');
const aiRoutes = require('./routes/aiRoutes');

// Initialize Express
const app = express();
const server = http.createServer(app);

// Setup allowed origins for Web and Mobile Capacitor clients
const allowedOrigins = [
  'http://localhost:5173',   // Vite local development
  'http://localhost',        // Android Capacitor default
  'https://localhost',       // Secure context mobile webview
  'capacitor://localhost'    // iOS Capacitor default
];
if (process.env.CLIENT_URL) {
  allowedOrigins.push(process.env.CLIENT_URL);
}

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// Store io instance on app for access in controllers
app.set('io', io);

// Initialize socket handlers
initializeSocket(io);

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/habits', habitRoutes);
app.use('/api/hobbies', hobbyRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/ai', aiRoutes);

// Error handler (must be after routes)
app.use(errorHandler);

// Connect to DB and start server
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📡 Socket.io ready`);
    console.log(`🌐 Health: http://localhost:${PORT}/health\n`);
  });
});
