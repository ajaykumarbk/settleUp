import express from 'express';
import multer from 'multer';
import path from 'path';
import { query } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Multer Config for receipt storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'receipt-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// POST /api/expenses/upload-receipt - Upload a receipt image
router.post('/upload-receipt', authenticateToken, upload.single('receipt'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  return res.json({ receiptUrl: fileUrl });
});

// GET /api/expenses - Retrieve expenses based on filters (groupId, friendId, or general)
router.get('/', authenticateToken, async (req, res) => {
  const currentUserId = req.user.id;
  const groupId = req.query.groupId ? parseInt(req.query.groupId) : null;
  const friendId = req.query.friendId ? parseInt(req.query.friendId) : null;

  try {
    let expenses = [];

    if (groupId) {
      // 1. Fetch expenses for a specific group
      // Verify membership first
      const membership = await query(
        'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
        [groupId, currentUserId]
      );
      if (membership.length === 0) {
        return res.status(403).json({ message: 'Not a member of this group' });
      }

      expenses = await query(
        `SELECT e.id, e.description, e.amount, e.currency, e.paid_by as paidBy,
                e.group_id as groupId, e.category, e.date, e.created_at as createdAt,
                e.receipt_url as receiptUrl,
                u.username as paidByName, u.avatar_url as paidByAvatar
         FROM expenses e
         JOIN users u ON e.paid_by = u.id
         WHERE e.group_id = ?
         ORDER BY e.date DESC, e.created_at DESC`,
        [groupId]
      );
    } else if (friendId) {
      // 2. Fetch direct expenses between current user and a friend (group_id is null)
      expenses = await query(
        `SELECT DISTINCT e.id, e.description, e.amount, e.currency, e.paid_by as paidBy,
                e.group_id as groupId, e.category, e.date, e.created_at as createdAt,
                e.receipt_url as receiptUrl,
                u.username as paidByName, u.avatar_url as paidByAvatar
         FROM expenses e
         JOIN users u ON e.paid_by = u.id
         JOIN expense_splits es ON e.id = es.expense_id
         WHERE e.group_id IS NULL AND (
           (e.paid_by = ? AND es.user_id = ?) OR
           (e.paid_by = ? AND es.user_id = ?)
         )
         ORDER BY e.date DESC, e.created_at DESC`,
        [currentUserId, friendId, friendId, currentUserId]
      );
    } else {
      // 3. General list of expenses for the user (any expense where they paid OR are in splits)
      expenses = await query(
        `SELECT DISTINCT e.id, e.description, e.amount, e.currency, e.paid_by as paidBy,
                e.group_id as groupId, e.category, e.date, e.created_at as createdAt,
                e.receipt_url as receiptUrl,
                u.username as paidByName, u.avatar_url as paidByAvatar,
                g.name as groupName
         FROM expenses e
         JOIN users u ON e.paid_by = u.id
         LEFT JOIN \`groups\` g ON e.group_id = g.id
         LEFT JOIN expense_splits es ON e.id = es.expense_id
         WHERE e.paid_by = ? OR es.user_id = ?
         ORDER BY e.date DESC, e.created_at DESC
         LIMIT 100`,
        [currentUserId, currentUserId]
      );
    }

    // Fetch and append splits for all retrieved expenses
    const expensesWithSplits = await Promise.all(
      expenses.map(async (exp) => {
        const splits = await query(
          `SELECT es.user_id as userId, es.amount, u.username, u.avatar_url as avatarUrl
           FROM expense_splits es
           JOIN users u ON es.user_id = u.id
           WHERE es.expense_id = ?`,
          [exp.id]
        );
        return {
          ...exp,
          amount: parseFloat(exp.amount),
          splits: splits.map(s => ({
            ...s,
            amount: parseFloat(s.amount)
          }))
        };
      })
    );

    return res.json(expensesWithSplits);
  } catch (error) {
    console.error('Fetch expenses error:', error);
    return res.status(500).json({ message: 'Error retrieving expenses' });
  }
});

// POST /api/expenses - Add a new expense with splitting logic
router.post('/', authenticateToken, async (req, res) => {
  const { description, amount, paidBy, groupId, category, date, splits, receiptUrl } = req.body;
  const currentUserId = req.user.id;

  if (!description || !amount || !splits || !Array.isArray(splits) || splits.length === 0) {
    return res.status(400).json({ message: 'Missing required fields: description, amount, splits' });
  }

  const parsedAmount = parseFloat(amount);
  const finalPaidBy = paidBy ? parseInt(paidBy) : currentUserId;
  const finalGroupId = groupId ? parseInt(groupId) : null;
  const finalCategory = category || 'General';
  const finalDate = date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

  // Validate split amounts match total amount
  const sumOfSplits = splits.reduce((sum, s) => sum + parseFloat(s.amount), 0);
  if (Math.abs(sumOfSplits - parsedAmount) > 0.05) {
    return res.status(400).json({
      message: `The sum of splits ($${sumOfSplits.toFixed(2)}) must match the total amount ($${parsedAmount.toFixed(2)})`
    });
  }

  try {
    // If inside a group, verify membership for all participants
    if (finalGroupId) {
      const groupMembers = await query(
        'SELECT user_id FROM group_members WHERE group_id = ?',
        [finalGroupId]
      );
      const memberIds = new Set(groupMembers.map(m => m.user_id));
      
      // Verify payer is in group
      if (!memberIds.has(finalPaidBy)) {
        return res.status(400).json({ message: 'Payer must be a member of the group' });
      }

      // Verify all split participants are in group
      for (const split of splits) {
        if (!memberIds.has(parseInt(split.userId))) {
          return res.status(400).json({ message: `User ID ${split.userId} in split is not in this group` });
        }
      }
    }

    // 1. Insert into expenses table
    const result = await query(
      `INSERT INTO expenses (description, amount, paid_by, group_id, category, date, receipt_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [description, parsedAmount, finalPaidBy, finalGroupId, finalCategory, finalDate, receiptUrl || null]
    );

    const expenseId = result.insertId;

    // 2. Insert into expense_splits table
    for (const split of splits) {
      await query(
        `INSERT INTO expense_splits (expense_id, user_id, amount)
         VALUES (?, ?, ?)`,
        [expenseId, parseInt(split.userId), parseFloat(split.amount)]
      );
    }

    return res.status(201).json({
      message: 'Expense added successfully',
      expenseId,
      description,
      amount: parsedAmount,
      paidBy: finalPaidBy,
      groupId: finalGroupId,
      category: finalCategory,
      date: finalDate,
      receiptUrl,
      splits
    });
  } catch (error) {
    console.error('Create expense error:', error);
    return res.status(500).json({ message: 'Error adding expense' });
  }
});

// DELETE /api/expenses/:id - Delete an expense
router.delete('/:id', authenticateToken, async (req, res) => {
  const expenseId = parseInt(req.params.id);
  const currentUserId = req.user.id;

  try {
    // 1. Fetch expense to verify ownership/membership
    const expenses = await query('SELECT * FROM expenses WHERE id = ?', [expenseId]);
    if (expenses.length === 0) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    const expense = expenses[0];

    // 2. Verify permission: must be either the payer OR a group member if group expense
    if (expense.paid_by !== currentUserId) {
      if (expense.group_id) {
        const membership = await query(
          'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
          [expense.group_id, currentUserId]
        );
        if (membership.length === 0) {
          return res.status(403).json({ message: 'You do not have permission to delete this expense' });
        }
      } else {
        // Individual expense, verify current user is in the splits
        const splits = await query(
          'SELECT * FROM expense_splits WHERE expense_id = ? AND user_id = ?',
          [expenseId, currentUserId]
        );
        if (splits.length === 0) {
          return res.status(403).json({ message: 'You do not have permission to delete this expense' });
        }
      }
    }

    // 3. Delete expense (Foreign Keys CASCADE will handle deleting expense_splits)
    await query('DELETE FROM expenses WHERE id = ?', [expenseId]);

    return res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Delete expense error:', error);
    return res.status(500).json({ message: 'Error deleting expense' });
  }
});

export default router;
