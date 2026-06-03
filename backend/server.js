import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDbPool } from './config/db.js';

// Import routes
import authRoutes from './routes/auth.js';
import friendRoutes from './routes/friends.js';
import groupRoutes from './routes/groups.js';
import expenseRoutes from './routes/expenses.js';
import settlementRoutes from './routes/settlements.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend development server
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploads statically
app.use('/uploads', express.static(uploadsDir));

// Database connection status tracking
let dbConnectionError = null;

// Initialize Database Connection
async function connectDatabase() {
  try {
    await getDbPool();
    dbConnectionError = null;
  } catch (error) {
    dbConnectionError = error.message;
    console.error('⚠️ Server starting in Degraded Mode (Database offline).');
  }
}

connectDatabase();

// Middleware to inject database health check for api routes
app.use((req, res, next) => {
  // Allow authentication check and system status to pass even if DB is offline
  if (dbConnectionError && !req.path.startsWith('/api/status') && !req.path.startsWith('/api/auth')) {
    return res.status(503).json({
      message: 'Database connection is unavailable',
      error: dbConnectionError,
      troubleshooting: 'Ensure MySQL is running on your VM and Oracle VCN allows ingress traffic on port 3306.'
    });
  }
  next();
});

// Status API
app.get('/api/status', (req, res) => {
  res.json({
    status: dbConnectionError ? 'degraded' : 'healthy',
    database: dbConnectionError ? 'disconnected' : 'connected',
    error: dbConnectionError || null,
    environment: process.env.NODE_ENV || 'development',
    time: new Date()
  });
});

// Bind API Routes
app.use('/api/auth', authRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/settlements', settlementRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('Splitwise Clone API is running. Health check at /api/status');
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack);
  res.status(500).json({
    message: 'Something went wrong on the server',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// Start listening
app.listen(PORT, () => {
  console.log(`🚀 Express server running on port ${PORT}`);
  console.log(`🔗 API Base: http://localhost:${PORT}`);
});
