import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'splitwise_jwt_secret_dev_key_987654321';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Please provide username, email and password' });
  }

  try {
    // Check if user already exists
    const existingUsers = await query(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    // Assign a beautiful default avatar from RoboHash
    const avatarUrl = `https://robohash.org/${encodeURIComponent(username)}.png?set=set4&bgset=bg1`;

    // Insert user
    const insertResult = await query(
      'INSERT INTO users (username, email, password_hash, avatar_url) VALUES (?, ?, ?, ?)',
      [username, email, passwordHash, avatarUrl]
    );

    const newUserId = insertResult.insertId;

    // Generate JWT token
    const token = jwt.sign(
      { id: newUserId, username, email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRE }
    );

    return res.status(201).json({
      token,
      user: {
        id: newUserId,
        username,
        email,
        avatarUrl
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ message: 'Internal server error during signup' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { emailOrUsername, password } = req.body;

  if (!emailOrUsername || !password) {
    return res.status(400).json({ message: 'Please provide email/username and password' });
  }

  try {
    // Find user by username or email
    const users = await query(
      'SELECT * FROM users WHERE email = ? OR username = ?',
      [emailOrUsername, emailOrUsername]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = users[0];

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRE }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatar_url
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error during login' });
  }
});

// GET /api/auth/me (Get current logged in user details)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const users = await query(
      'SELECT id, username, email, avatar_url as avatarUrl, created_at as createdAt FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json(users[0]);
  } catch (error) {
    console.error('Fetch me error:', error);
    return res.status(500).json({ message: 'Internal server error fetching user profile' });
  }
});

// GET /api/auth/export - Export backup of all user data
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Fetch User details
    const user = (await query('SELECT id, username, email, created_at as createdAt FROM users WHERE id = ?', [userId]))[0];

    // 2. Fetch Friends
    const friends = await query(
      `SELECT u.id, u.username, u.email
       FROM users u
       JOIN friends f ON (f.user_id1 = u.id OR f.user_id2 = u.id)
       WHERE (f.user_id1 = ? OR f.user_id2 = ?) AND u.id != ?`,
      [userId, userId, userId]
    );

    // 3. Fetch Groups
    const groups = await query(
      `SELECT g.id, g.name, g.description
       FROM \`groups\` g
       JOIN group_members gm ON g.id = gm.group_id
       WHERE gm.user_id = ?`,
      [userId]
    );

    // 4. Fetch Expenses
    const expenses = await query(
      `SELECT DISTINCT e.id, e.description, e.amount, e.currency, e.category, e.date, e.group_id, e.paid_by
       FROM expenses e
       LEFT JOIN expense_splits es ON e.id = es.expense_id
       WHERE e.paid_by = ? OR es.user_id = ?`,
      [userId, userId]
    );

    // Fetch splits for those expenses
    const expensesWithSplits = await Promise.all(
      expenses.map(async (exp) => {
        const splits = await query(
          `SELECT user_id as userId, amount FROM expense_splits WHERE expense_id = ?`,
          [exp.id]
        );
        return { 
          ...exp, 
          amount: parseFloat(exp.amount),
          splits: splits.map(s => ({ ...s, amount: parseFloat(s.amount) }))
        };
      })
    );

    // 5. Fetch Settlements
    const settlements = await query(
      `SELECT id, payer_id as payerId, payee_id as payeeId, amount, group_id as groupId, date
       FROM settlements
       WHERE payer_id = ? OR payee_id = ?`,
      [userId, userId]
    );

    const backupData = {
      exportedAt: new Date().toISOString(),
      user,
      friends,
      groups,
      expenses: expensesWithSplits,
      settlements: settlements.map(s => ({ ...s, amount: parseFloat(s.amount) }))
    };

    res.setHeader('Content-disposition', `attachment; filename=splitwise_backup_${user.username}.json`);
    res.setHeader('Content-type', 'application/json');
    return res.send(JSON.stringify(backupData, null, 2));
  } catch (error) {
    console.error('Export error:', error);
    return res.status(500).json({ message: 'Error generating user data backup' });
  }
});

export default router;
