import express from 'express';
import { query } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/friends - List all friends
router.get('/', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    
    const friends = await query(
      `SELECT u.id, u.username, u.email, u.avatar_url as avatarUrl
       FROM users u
       JOIN friends f ON (f.user_id1 = u.id OR f.user_id2 = u.id)
       WHERE (f.user_id1 = ? OR f.user_id2 = ?) AND u.id != ?
       ORDER BY u.username ASC`,
      [currentUserId, currentUserId, currentUserId]
    );

    return res.json(friends);
  } catch (error) {
    console.error('Fetch friends error:', error);
    return res.status(500).json({ message: 'Error retrieving friends list' });
  }
});

// POST /api/friends/add - Add friend by email or username
router.post('/add', authenticateToken, async (req, res) => {
  const { emailOrUsername } = req.body;
  const currentUserId = req.user.id;

  if (!emailOrUsername) {
    return res.status(400).json({ message: 'Please provide a username or email' });
  }

  try {
    // 1. Find user to add
    const users = await query(
      'SELECT id, username, email, avatar_url FROM users WHERE email = ? OR username = ?',
      [emailOrUsername, emailOrUsername]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const friendUser = users[0];
    const friendId = friendUser.id;

    // 2. Prevent adding self
    if (friendId === currentUserId) {
      return res.status(400).json({ message: "You cannot add yourself as a friend" });
    }

    // 3. Check if already friends
    const user1 = Math.min(currentUserId, friendId);
    const user2 = Math.max(currentUserId, friendId);

    const existingFriendship = await query(
      'SELECT * FROM friends WHERE user_id1 = ? AND user_id2 = ?',
      [user1, user2]
    );

    if (existingFriendship.length > 0) {
      return res.status(400).json({ message: 'You are already friends with this user' });
    }

    // 4. Add friendship
    await query(
      'INSERT INTO friends (user_id1, user_id2) VALUES (?, ?)',
      [user1, user2]
    );

    return res.status(201).json({
      message: 'Friend added successfully',
      friend: {
        id: friendUser.id,
        username: friendUser.username,
        email: friendUser.email,
        avatarUrl: friendUser.avatar_url
      }
    });
  } catch (error) {
    console.error('Add friend error:', error);
    return res.status(500).json({ message: 'Error adding friend' });
  }
});

// GET /api/friends/balances - Get net balance summary with each friend
router.get('/balances', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // Fetch all friends
    const friends = await query(
      `SELECT u.id, u.username, u.email, u.avatar_url as avatarUrl
       FROM users u
       JOIN friends f ON (f.user_id1 = u.id OR f.user_id2 = u.id)
       WHERE (f.user_id1 = ? OR f.user_id2 = ?) AND u.id != ?`,
      [currentUserId, currentUserId, currentUserId]
    );

    if (friends.length === 0) {
      return res.json([]);
    }

    // Initialize balance map
    const balances = {};
    friends.forEach(f => {
      balances[f.id] = {
        friend: f,
        netBalance: 0
      };
    });

    // 1. Fetch splits where current user paid
    // We get all expense splits where the current user paid the overall expense, and the split user is a friend
    const paidSplits = await query(
      `SELECT es.user_id as debtor_id, es.amount
       FROM expense_splits es
       JOIN expenses e ON es.expense_id = e.id
       WHERE e.paid_by = ? AND es.user_id != ?`,
      [currentUserId, currentUserId]
    );

    paidSplits.forEach(split => {
      if (balances[split.debtor_id]) {
        balances[split.debtor_id].netBalance += parseFloat(split.amount);
      }
    });

    // 2. Fetch splits where friend paid, and current user owes
    const owedSplits = await query(
      `SELECT e.paid_by as creditor_id, es.amount
       FROM expense_splits es
       JOIN expenses e ON es.expense_id = e.id
       WHERE es.user_id = ? AND e.paid_by != ?`,
      [currentUserId, currentUserId]
    );

    owedSplits.forEach(split => {
      if (balances[split.creditor_id]) {
        balances[split.creditor_id].netBalance -= parseFloat(split.amount);
      }
    });

    // 3. Fetch settlements between current user and friends
    const settlements = await query(
      `SELECT payer_id, payee_id, amount 
       FROM settlements
       WHERE (payer_id = ? OR payee_id = ?)`,
      [currentUserId, currentUserId]
    );

    settlements.forEach(settlement => {
      const payerId = settlement.payer_id;
      const payeeId = settlement.payee_id;
      const amount = parseFloat(settlement.amount);

      if (payerId === currentUserId) {
        // Current user paid friend, so current user's balance relative to friend increases
        if (balances[payeeId]) {
          balances[payeeId].netBalance += amount;
        }
      } else {
        // Friend paid current user, so current user's balance relative to friend decreases
        if (balances[payerId]) {
          balances[payerId].netBalance -= amount;
        }
      }
    });

    // Format output, round balances, filter out friends with exactly 0 balance if we only want active balances,
    // but typically we return all friends with their net balances.
    const result = Object.values(balances).map(b => ({
      ...b,
      netBalance: Math.round(b.netBalance * 100) / 100
    }));

    return res.json(result);
  } catch (error) {
    console.error('Fetch friend balances error:', error);
    return res.status(500).json({ message: 'Error retrieving friend balances' });
  }
});

export default router;
