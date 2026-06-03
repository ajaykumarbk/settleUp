import express from 'express';
import { query } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/settlements - List settlements based on filters
router.get('/', authenticateToken, async (req, res) => {
  const currentUserId = req.user.id;
  const groupId = req.query.groupId ? parseInt(req.query.groupId) : null;
  const friendId = req.query.friendId ? parseInt(req.query.friendId) : null;

  try {
    let settlements = [];

    if (groupId) {
      // 1. Fetch settlements in a group
      settlements = await query(
        `SELECT s.id, s.amount, s.payer_id as payerId, s.payee_id as payeeId,
                s.group_id as groupId, s.date, s.created_at as createdAt,
                p.username as payerName, p.avatar_url as payerAvatar,
                r.username as payeeName, r.avatar_url as payeeAvatar
         FROM settlements s
         JOIN users p ON s.payer_id = p.id
         JOIN users r ON s.payee_id = r.id
         WHERE s.group_id = ?
         ORDER BY s.date DESC, s.created_at DESC`,
        [groupId]
      );
    } else if (friendId) {
      // 2. Fetch direct settlements between current user and friend (outside any group)
      settlements = await query(
        `SELECT s.id, s.amount, s.payer_id as payerId, s.payee_id as payeeId,
                s.group_id as groupId, s.date, s.created_at as createdAt,
                p.username as payerName, p.avatar_url as payerAvatar,
                r.username as payeeName, r.avatar_url as payeeAvatar
         FROM settlements s
         JOIN users p ON s.payer_id = p.id
         JOIN users r ON s.payee_id = r.id
         WHERE s.group_id IS NULL AND (
           (s.payer_id = ? AND s.payee_id = ?) OR
           (s.payer_id = ? AND s.payee_id = ?)
         )
         ORDER BY s.date DESC, s.created_at DESC`,
        [currentUserId, friendId, friendId, currentUserId]
      );
    } else {
      // 3. General history of all settlements for the user
      settlements = await query(
        `SELECT s.id, s.amount, s.payer_id as payerId, s.payee_id as payeeId,
                s.group_id as groupId, s.date, s.created_at as createdAt,
                p.username as payerName, p.avatar_url as payerAvatar,
                r.username as payeeName, r.avatar_url as payeeAvatar,
                g.name as groupName
         FROM settlements s
         JOIN users p ON s.payer_id = p.id
         JOIN users r ON s.payee_id = r.id
         LEFT JOIN \`groups\` g ON s.group_id = g.id
         WHERE s.payer_id = ? OR s.payee_id = ?
         ORDER BY s.date DESC, s.created_at DESC
         LIMIT 50`,
        [currentUserId, currentUserId]
      );
    }

    // Parse decimal amounts
    const result = settlements.map(s => ({
      ...s,
      amount: parseFloat(s.amount)
    }));

    return res.json(result);
  } catch (error) {
    console.error('Fetch settlements error:', error);
    return res.status(500).json({ message: 'Error retrieving settlements' });
  }
});

// POST /api/settlements - Log a new payment/settlement
router.post('/', authenticateToken, async (req, res) => {
  const { payerId, payeeId, amount, groupId, date } = req.body;
  const currentUserId = req.user.id;

  if (!payerId || !payeeId || !amount) {
    return res.status(400).json({ message: 'Missing required fields: payerId, payeeId, amount' });
  }

  const parsedPayerId = parseInt(payerId);
  const parsedPayeeId = parseInt(payeeId);
  const parsedAmount = parseFloat(amount);
  const finalGroupId = groupId ? parseInt(groupId) : null;
  const finalDate = date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

  if (parsedPayerId === parsedPayeeId) {
    return res.status(400).json({ message: 'Payer and Payee cannot be the same user' });
  }

  // Verify that the current user is authorized to log this (must be either the payer or payee)
  if (parsedPayerId !== currentUserId && parsedPayeeId !== currentUserId) {
    return res.status(403).json({ message: 'You can only record settlements that you are a part of' });
  }

  try {
    // If logging inside a group, verify both users are group members
    if (finalGroupId) {
      const memberships = await query(
        'SELECT user_id FROM group_members WHERE group_id = ? AND user_id IN (?, ?)',
        [finalGroupId, parsedPayerId, parsedPayeeId]
      );

      if (memberships.length < 2) {
        return res.status(400).json({ message: 'Both payer and payee must be members of the group' });
      }
    } else {
      // If direct settlement, ensure they are friends
      const u1 = Math.min(parsedPayerId, parsedPayeeId);
      const u2 = Math.max(parsedPayerId, parsedPayeeId);
      const friendship = await query(
        'SELECT * FROM friends WHERE user_id1 = ? AND user_id2 = ?',
        [u1, u2]
      );
      if (friendship.length === 0) {
        // Auto-create friendship upon settlement to keep systems synchronized
        await query('INSERT INTO friends (user_id1, user_id2) VALUES (?, ?)', [u1, u2]);
      }
    }

    // Insert settlement log
    const result = await query(
      `INSERT INTO settlements (payer_id, payee_id, amount, group_id, date)
       VALUES (?, ?, ?, ?, ?)`,
      [parsedPayerId, parsedPayeeId, parsedAmount, finalGroupId, finalDate]
    );

    return res.status(201).json({
      message: 'Settlement recorded successfully',
      settlementId: result.insertId,
      payerId: parsedPayerId,
      payeeId: parsedPayeeId,
      amount: parsedAmount,
      groupId: finalGroupId,
      date: finalDate
    });
  } catch (error) {
    console.error('Create settlement error:', error);
    return res.status(500).json({ message: 'Error logging settlement' });
  }
});

export default router;
