import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDbPool, query } from './config/db.js';

// Import routes
import authRoutes from './routes/auth.js';
import friendRoutes from './routes/friends.js';
import groupRoutes from './routes/groups.js';
import expenseRoutes from './routes/expenses.js';
import settlementRoutes from './routes/settlements.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend clients (development and production)
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://settle-up-green.vercel.app'
];
if (process.env.FRONTEND_URL) {
  process.env.FRONTEND_URL.split(',').forEach(url => allowedOrigins.push(url.trim()));
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const sanitizedOrigin = origin.replace(/\/$/, '');
    const isAllowed = allowedOrigins.some(allowed => allowed.replace(/\/$/, '') === sanitizedOrigin);
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
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

// Recurring Expense Processor Daemon
async function processRecurringExpenses() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const recurring = await query(
      `SELECT * FROM expenses WHERE is_recurring = 1 AND next_recurrence_date <= ?`,
      [today]
    );

    if (recurring.length === 0) return;

    console.log(`⏰ Processing ${recurring.length} recurring expenses...`);

    for (const exp of recurring) {
      const expDate = exp.next_recurrence_date;
      
      // 1. Create duplicated expense on the next_recurrence_date (non-recurring instance)
      const result = await query(
        `INSERT INTO expenses (description, amount, paid_by, group_id, category, date, receipt_url, is_recurring, recurrence_interval, next_recurrence_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL)`,
        [exp.description, exp.amount, exp.paid_by, exp.group_id, exp.category, expDate, exp.receipt_url]
      );
      const newExpenseId = result.insertId;

      // 2. Fetch splits of original expense
      const splits = await query(
        `SELECT user_id, amount FROM expense_splits WHERE expense_id = ?`,
        [exp.id]
      );

      // 3. Insert splits for the duplicated expense
      for (const split of splits) {
        await query(
          `INSERT INTO expense_splits (expense_id, user_id, amount)
           VALUES (?, ?, ?)`,
          [newExpenseId, split.user_id, split.amount]
        );
      }

      // 4. Calculate the next recurrence date
      const interval = exp.recurrence_interval || 'monthly';
      const nextDate = new Date(expDate);
      if (interval === 'daily') {
        nextDate.setDate(nextDate.getDate() + 1);
      } else if (interval === 'weekly') {
        nextDate.setDate(nextDate.getDate() + 7);
      } else if (interval === 'monthly') {
        nextDate.setMonth(nextDate.getMonth() + 1);
      } else if (interval === 'yearly') {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      }
      const nextDateStr = nextDate.toISOString().split('T')[0];

      // 5. Update next_recurrence_date of original template expense
      await query(
        `UPDATE expenses SET next_recurrence_date = ? WHERE id = ?`,
        [nextDateStr, exp.id]
      );

      console.log(`✅ Duplicated recurring expense "${exp.description}" for date ${expDate}. Next recurrence set to ${nextDateStr}.`);
    }
  } catch (err) {
    console.error('❌ Error processing recurring expenses:', err.message);
  }
}

// Initialize Database Connection
async function connectDatabase() {
  try {
    await getDbPool();
    dbConnectionError = null;
    
    // Process due recurring expenses immediately and start periodic checks
    await processRecurringExpenses();
    setInterval(processRecurringExpenses, 30 * 60 * 1000); // run every 30 minutes
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

// Serve frontend static assets in production
if (process.env.NODE_ENV === 'production') {
  const distDir = path.join(__dirname, 'dist');
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  // Root route
  app.get('/', (req, res) => {
    res.send('Splitwise Clone API is running. Health check at /api/status');
  });
}

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
