import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import os from 'os';
import { OAuth2Client } from 'google-auth-library';
import { query } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'splitwise_jwt_secret_dev_key_987654321';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

// Setup mail transporter (using environment variables if provided)
const smtpEmail = process.env.SMTP_EMAIL;
const smtpPass = process.env.SMTP_PASSWORD;
let transporter = null;

if (smtpEmail && smtpPass) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: smtpEmail,
      pass: smtpPass
    },
    connectionTimeout: 5000, // 5s timeout to prevent hanging on cloud servers
    greetingTimeout: 5000,
    socketTimeout: 5000
  });
}

// Validator helper for @gmail.com addresses
function isGmailAddress(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return false;
  const domain = email.split('@')[1].toLowerCase();
  return domain === 'gmail.com';
}

// Helper to dynamically retrieve the laptop's local network IP address
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Find the active, non-loopback IPv4 address
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Please provide username, email and password' });
  }

  // 1. Strictly restrict to @gmail.com
  if (!isGmailAddress(email)) {
    return res.status(400).json({ message: 'Registration is strictly restricted to valid @gmail.com email addresses.' });
  }

  try {
    // Check if user already exists
    const existingUsers = await query(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'Username or email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    // Assign a beautiful default avatar from RoboHash
    const avatarUrl = `https://robohash.org/${encodeURIComponent(username)}.png?set=set4&bgset=bg1`;

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Insert user (is_verified = 0)
    const insertResult = await query(
      'INSERT INTO users (username, email, password_hash, avatar_url, is_verified, verification_token) VALUES (?, ?, ?, ?, 0, ?)',
      [username, email, passwordHash, avatarUrl, verificationToken]
    );

    const newUserId = insertResult.insertId;
    
    // Resolve the real local IP address if registering via localhost
    let backendUrl = process.env.BACKEND_URL;
    if (!backendUrl) {
      const host = req.get('host'); // e.g. "localhost:5000" or "127.0.0.1:5000"
      if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
        const localIp = getLocalIpAddress();
        const port = host.split(':')[1] || '5000';
        backendUrl = `${req.protocol}://${localIp}:${port}`;
      } else {
        backendUrl = `${req.protocol}://${host}`;
      }
    }
    
    const verificationUrl = `${backendUrl}/api/auth/verify-email?token=${verificationToken}`;

    // Try to send email
    if (transporter) {
      try {
        await transporter.sendMail({
          to: email,
          subject: 'SettleUp - Verify Your Gmail Account',
          html: `
            <div style="font-family: sans-serif; padding: 30px; background: #0b0f19; color: #f8fafc; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); max-width: 480px; margin: 0 auto;">
              <h2 style="color: #6366f1; font-weight: 700; margin-top: 0;">Welcome to SettleUp!</h2>
              <p style="font-size: 1rem; line-height: 1.5; color: #f8fafc;">Thank you for signing up. Please click the button below to verify your Gmail account and activate your profile:</p>
              <div style="text-align: center; margin: 24px 0;">
                <a href="${verificationUrl}" style="display: inline-block; padding: 12px 28px; background: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 1rem; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);">
                  Verify Gmail Address
                </a>
              </div>
              <p style="color: #94a3b8; font-size: 0.8rem; line-height: 1.4; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 16px; margin-bottom: 0;">
                If you did not request this account, you can safely ignore this message.
              </p>
            </div>
          `
        });
        
        return res.status(201).json({
          message: 'Registration successful! A verification link has been sent to your Gmail inbox. Please verify your email before logging in.',
          requiresVerification: true
        });
      } catch (err) {
        console.error('SMTP Email Send Failure (Auto-verifying user as fallback):', err.message);
        // Auto-verify user so they don't get locked out or face hung requests on Render
        await query('UPDATE users SET is_verified = 1, verification_token = NULL WHERE id = ?', [newUserId]);
        return res.status(201).json({
          message: 'Registration successful! (SMTP email verification failed, so your account has been auto-verified for convenience.)',
          requiresVerification: false
        });
      }
    } else {
      // SMTP not configured on the server
      console.warn('SMTP Configuration Error (Auto-verifying user): Transporter is not initialized.');
      await query('UPDATE users SET is_verified = 1, verification_token = NULL WHERE id = ?', [newUserId]);
      return res.status(201).json({
        message: 'Registration successful! (Email verification is disabled, your account is auto-verified.)',
        requiresVerification: false
      });
    }

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

    // Enforce email verification (if not verified, block login)
    if (!user.is_verified) {
      return res.status(403).json({ 
        message: 'Account not verified. Please verify your @gmail.com address before logging in.',
        requiresVerification: true
      });
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

// GET /api/auth/verify-email
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;

  const errorHtml = (msg) => `
    <!DOCTYPE html>
    <html>
      <head>
        <title>SettleUp - Verification Failed</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: sans-serif; background: #0b0f19; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
          .card { background: rgba(22, 28, 45, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(244, 63, 94, 0.2); padding: 40px; border-radius: 16px; text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.4); max-width: 420px; width: 100%; }
          .icon { width: 64px; height: 64px; border-radius: 50%; background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.2); color: #f43f5e; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 32px; font-weight: bold; }
          h2 { color: #f43f5e; margin-bottom: 12px; font-weight: 700; margin-top: 0; }
          p { color: #94a3b8; line-height: 1.6; font-size: 0.95rem; margin-bottom: 0; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✗</div>
          <h2>Verification Failed</h2>
          <p>${msg}</p>
        </div>
      </body>
    </html>
  `;

  if (!token) {
    return res.status(400).send(errorHtml('Verification token is missing. Please check your verification link.'));
  }

  try {
    const users = await query('SELECT id FROM users WHERE verification_token = ?', [token]);
    if (users.length === 0) {
      return res.status(400).send(errorHtml('Invalid or expired verification token. Please check your link or register again.'));
    }

    const userId = users[0].id;

    // Mark as verified and clear verification token
    await query(
      'UPDATE users SET is_verified = 1, verification_token = NULL WHERE id = ?',
      [userId]
    );

    // Return responsive premium HTML Success page
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>SettleUp - Account Verified</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: sans-serif; background: #0b0f19; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
            .card { background: rgba(22, 28, 45, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.08); padding: 40px; border-radius: 16px; text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.37); max-width: 420px; width: 100%; }
            .icon { width: 64px; height: 64px; border-radius: 50%; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); color: #10b981; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 32px; font-weight: bold; }
            h2 { color: #10b981; margin-bottom: 12px; font-weight: 700; margin-top: 0; }
            p { color: #94a3b8; line-height: 1.6; font-size: 0.95rem; margin-bottom: 0; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">✓</div>
            <h2>Email Verified!</h2>
            <p>Your @gmail.com account has been successfully activated. You can now return to your laptop and log in immediately.</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Verification error:', error);
    return res.status(500).send(errorHtml('Internal server error during verification. Please try again later.'));
  }
});

// POST /api/auth/google
router.post('/google', async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({ message: 'ID Token is required' });
  }

  try {
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (!googleClientId) {
      return res.status(500).json({ message: 'Google Client ID is not configured on the server.' });
    }

    const oAuth2Client = new OAuth2Client(googleClientId);
    
    // Verify the Google ID Token
    const ticket = await oAuth2Client.verifyIdToken({
      idToken,
      audience: googleClientId,
    });
    
    const payload = ticket.getPayload();
    const { email, name, picture, email_verified } = payload;

    // Check if Google certifies this email is verified
    if (!email_verified) {
      return res.status(400).json({ message: 'Google email address is not verified.' });
    }

    // Strictly restrict to standard @gmail.com
    if (!isGmailAddress(email)) {
      return res.status(400).json({ message: 'Authentication is strictly limited to standard @gmail.com accounts.' });
    }

    // Check if the user already exists in the database
    let users = await query('SELECT * FROM users WHERE email = ?', [email]);
    let user;

    if (users.length === 0) {
      // Create user automatically (marked as verified)
      const randomPassword = crypto.randomBytes(16).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      const result = await query(
        `INSERT INTO users (username, email, password_hash, is_verified, avatar_url) 
         VALUES (?, ?, ?, 1, ?)`,
        [name, email, hashedPassword, picture]
      );
      
      user = {
        id: result.insertId,
        username: name,
        email,
        avatar_url: picture
      };
    } else {
      user = users[0];
      // If user was previously unverified but logged in via Google, activate them
      if (!user.is_verified) {
        await query('UPDATE users SET is_verified = 1, verification_token = NULL WHERE id = ?', [user.id]);
        user.is_verified = 1;
      }
    }

    // Generate JWT Session token
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
    console.error('Google Sign-in error:', error);
    return res.status(400).json({ message: 'Google Authentication failed. Please try again.' });
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
