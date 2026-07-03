const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars from root .env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const logger = require('./utils/logger');
const errorHandler = require('./middlewares/errorHandler');
const { globalLimiter } = require('./middlewares/rateLimiter');
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
const storageRoutes = require('./routes/storageRoutes');
const voiceRoutes = require('./routes/voiceRoutes');
const walkieRoutes = require('./routes/walkieRoutes');

// ── Initialize Express ────────────────────────────────────
const app = express();
const server = http.createServer(app);

// ── Allowed Origins ───────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',   // Vite local development
  'http://localhost',        // Android Capacitor default
  'https://localhost',       // Secure context mobile webview
  'capacitor://localhost',   // iOS Capacitor default
];

// Add production client URL from env
if (process.env.CLIENT_URL) {
  // Trim trailing slash if present
  allowedOrigins.push(process.env.CLIENT_URL.replace(/\/$/, ''));
}

// Automatically trust Vercel deployments if VERCEL_URL is present
if (process.env.VERCEL_URL) {
  allowedOrigins.push(`https://${process.env.VERCEL_URL}`);
}
// Also allow the main production Vercel domain if known
allowedOrigins.push('https://produx-orcin.vercel.app');

// Add any additional comma-separated CORS origins from env
if (process.env.ADDITIONAL_ALLOWED_ORIGINS) {
  const extras = process.env.ADDITIONAL_ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  allowedOrigins.push(...extras);
}

// ── Security Middleware ───────────────────────────────────
// helmet sets security-related HTTP headers
app.use(
  helmet({
    // Allow cross-origin resources for socket.io and firebase CDN
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // Customize CSP if needed — kept permissive for SPA + Firebase
    contentSecurityPolicy: false,
  })
);

// ── CORS ──────────────────────────────────────────────────
const corsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server requests (no origin) and whitelisted origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy: origin '${origin}' is not allowed.`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Pre-flight for all routes

// ── Socket.io ─────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
  // Prefer WebSocket, fall back to polling (necessary for Vercel)
  transports: ['websocket', 'polling'],
  // Reduce memory footprint per connection
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Store io instance on app for access in controllers
app.set('io', io);

// Initialize socket handlers
initializeSocket(io);

// ── Body Parsers ──────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false }));

// ── Global Rate Limiting ──────────────────────────────────
// Apply global limiter to all API routes
app.use('/api', globalLimiter);

// ── Health Check ──────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ── API Routes ────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/habits', habitRoutes);
app.use('/api/hobbies', hobbyRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/walkie', walkieRoutes);

// ── 404 Handler ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.path}`,
  });
});

// ── Global Error Handler (must be last) ───────────────────
app.use(errorHandler);

// ── Start Server (skip when deploying as Vercel Serverless) ──
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT}`);
    logger.info(`📡 Socket.io ready`);
    logger.info(`🌐 Health: http://localhost:${PORT}/health`);
    logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

// Export the Express app for Vercel Serverless Functions
module.exports = app;
