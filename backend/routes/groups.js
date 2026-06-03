import express from 'express';
import { query } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { simplifyDebts } from '../utils/debtSimplifier.js';

const router = express.Router();

// GET /api/groups - Get all groups for the logged-in user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // Fetch groups where the user is a member, including count of members
    const groups = await query(
      `SELECT g.id, g.name, g.description, g.created_by as createdBy, g.created_at as createdAt,
              (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as membersCount
       FROM \`groups\` g
       JOIN group_members gm ON g.id = gm.group_id
       WHERE gm.user_id = ?
       ORDER BY g.created_at DESC`,
      [currentUserId]
    );

    return res.json(groups);
  } catch (error) {
    console.error('Fetch groups error:', error);
    return res.status(500).json({ message: 'Error fetching groups' });
  }
});

// POST /api/groups - Create a new group
router.post('/', authenticateToken, async (req, res) => {
  const { name, description, memberEmails } = req.body;
  const currentUserId = req.user.id;

  if (!name) {
    return res.status(400).json({ message: 'Group name is required' });
  }

  try {
    // 1. Insert Group
    const groupResult = await query(
      'INSERT INTO `groups` (name, description, created_by) VALUES (?, ?, ?)',
      [name, description || '', currentUserId]
    );
    const groupId = groupResult.insertId;

    // 2. Add Creator as Member
    await query(
      'INSERT INTO group_members (group_id, user_id) VALUES (?, ?)',
      [groupId, currentUserId]
    );

    // 3. Add other members by email if provided
    if (memberEmails && Array.isArray(memberEmails) && memberEmails.length > 0) {
      for (const email of memberEmails) {
        const trimmedEmail = email.trim();
        if (!trimmedEmail) continue;

        // Find user by email
        const users = await query('SELECT id FROM users WHERE email = ?', [trimmedEmail]);
        if (users.length > 0) {
          const userIdToAdd = users[0].id;
          
          // Verify not adding creator again
          if (userIdToAdd !== currentUserId) {
            // Check if already member (safety check)
            const membership = await query(
              'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
              [groupId, userIdToAdd]
            );
            if (membership.length === 0) {
              await query(
                'INSERT INTO group_members (group_id, user_id) VALUES (?, ?)',
                [groupId, userIdToAdd]
              );
            }
          }
        }
      }
    }

    return res.status(201).json({
      message: 'Group created successfully',
      groupId,
      name,
      description
    });
  } catch (error) {
    console.error('Create group error:', error);
    return res.status(500).json({ message: 'Error creating group' });
  }
});

// GET /api/groups/:id - Get specific group details, members, expenses, and simplified debts
router.get('/:id', authenticateToken, async (req, res) => {
  const groupId = parseInt(req.params.id);
  const currentUserId = req.user.id;

  try {
    // 1. Verify user is member of this group
    const membership = await query(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, currentUserId]
    );

    if (membership.length === 0) {
      return res.status(403).json({ message: 'You are not a member of this group' });
    }

    // 2. Fetch Group details
    const groups = await query(
      'SELECT id, name, description, created_by as createdBy, created_at as createdAt, default_split_type as defaultSplitType, default_split_shares as defaultSplitShares FROM `groups` WHERE id = ?',
      [groupId]
    );
    const group = groups[0];
    if (group) {
      group.defaultSplitShares = group.defaultSplitShares ? JSON.parse(group.defaultSplitShares) : null;
    }

    // 3. Fetch Group members
    const members = await query(
      `SELECT u.id, u.username, u.email, u.avatar_url as avatarUrl
       FROM users u
       JOIN group_members gm ON u.id = gm.user_id
       WHERE gm.group_id = ?
       ORDER BY u.username ASC`,
      [groupId]
    );

    // 4. Calculate Group Balances & Simplified Debts
    // Initialize balance mapping for all members to 0
    const memberBalances = {};
    members.forEach(m => {
      memberBalances[m.id] = 0;
    });

    // A. Fetch expenses and splits inside this group
    const expenses = await query(
      `SELECT id, amount, paid_by as paidBy FROM expenses WHERE group_id = ?`,
      [groupId]
    );

    for (const exp of expenses) {
      const expId = exp.id;
      const amount = parseFloat(exp.amount);
      const paidBy = exp.paidBy;

      // Add to payer's balance
      if (memberBalances[paidBy] !== undefined) {
        memberBalances[paidBy] += amount;
      }

      // Fetch splits for this expense
      const splits = await query(
        `SELECT user_id, amount FROM expense_splits WHERE expense_id = ?`,
        [expId]
      );

      splits.forEach(split => {
        const uId = split.user_id;
        const splitAmount = parseFloat(split.amount);
        if (memberBalances[uId] !== undefined) {
          memberBalances[uId] -= splitAmount;
        }
      });
    }

    // B. Fetch settlements inside this group
    const settlements = await query(
      `SELECT payer_id, payee_id, amount FROM settlements WHERE group_id = ?`,
      [groupId]
    );

    settlements.forEach(settle => {
      const payerId = settle.payer_id;
      const payeeId = settle.payee_id;
      const amount = parseFloat(settle.amount);

      if (memberBalances[payerId] !== undefined) {
        memberBalances[payerId] += amount; // Reduces payer's overall debt
      }
      if (memberBalances[payeeId] !== undefined) {
        memberBalances[payeeId] -= amount; // Reduces payee's overall credit
      }
    });

    // Simplify debts using the utility algorithm
    const simplifiedDebts = simplifyDebts(memberBalances, members);

    // Format individual balances for API return
    const formattedBalances = members.map(m => ({
      userId: m.id,
      username: m.username,
      avatarUrl: m.avatarUrl,
      netBalance: Math.round(memberBalances[m.id] * 100) / 100
    }));

    return res.json({
      group,
      members,
      balances: formattedBalances,
      simplifiedDebts
    });
  } catch (error) {
    console.error('Fetch group details error:', error);
    return res.status(500).json({ message: 'Error retrieving group details' });
  }
});

// POST /api/groups/:id/members - Add a member to an existing group by email
router.post('/:id/members', authenticateToken, async (req, res) => {
  const groupId = parseInt(req.params.id);
  const { email } = req.body;
  const currentUserId = req.user.id;

  if (!email) {
    return res.status(400).json({ message: 'Email address is required' });
  }

  try {
    // 1. Verify current user is in group
    const currentMembership = await query(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, currentUserId]
    );
    if (currentMembership.length === 0) {
      return res.status(403).json({ message: 'Only group members can add other members' });
    }

    // 2. Find user to add
    const users = await query('SELECT id, username, email, avatar_url FROM users WHERE email = ?', [email.trim()]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found. They must sign up first.' });
    }

    const targetUser = users[0];
    const targetUserId = targetUser.id;

    // 3. Verify not already a member
    const existingMembership = await query(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, targetUserId]
    );
    if (existingMembership.length > 0) {
      return res.status(400).json({ message: 'User is already a member of this group' });
    }

    // 4. Add member
    await query(
      'INSERT INTO group_members (group_id, user_id) VALUES (?, ?)',
      [groupId, targetUserId]
    );

    // 5. Establish default friendship relationship as well (Splitwise auto-friends group mates)
    const u1 = Math.min(currentUserId, targetUserId);
    const u2 = Math.max(currentUserId, targetUserId);
    const friendshipCheck = await query(
      'SELECT * FROM friends WHERE user_id1 = ? AND user_id2 = ?',
      [u1, u2]
    );
    if (friendshipCheck.length === 0) {
      await query('INSERT INTO friends (user_id1, user_id2) VALUES (?, ?)', [u1, u2]);
    }

    return res.status(201).json({
      message: 'Member added successfully',
      member: {
        id: targetUser.id,
        username: targetUser.username,
        email: targetUser.email,
        avatarUrl: targetUser.avatar_url
      }
    });
  } catch (error) {
    console.error('Add group member error:', error);
    return res.status(500).json({ message: 'Error adding member' });
  }
});

// PUT /api/groups/:id/default-split - Save default split settings for the group
router.put('/:id/default-split', authenticateToken, async (req, res) => {
  const groupId = parseInt(req.params.id);
  const { defaultSplitType, defaultSplitShares } = req.body;
  const currentUserId = req.user.id;

  if (!defaultSplitType) {
    return res.status(400).json({ message: 'defaultSplitType is required' });
  }

  try {
    // Verify group exists
    const groups = await query('SELECT created_by FROM `groups` WHERE id = ?', [groupId]);
    if (groups.length === 0) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Only group creator can edit settings
    if (groups[0].created_by !== currentUserId) {
      return res.status(403).json({ message: 'Only the group creator can update default split settings' });
    }

    await query(
      'UPDATE `groups` SET default_split_type = ?, default_split_shares = ? WHERE id = ?',
      [defaultSplitType, defaultSplitShares ? JSON.stringify(defaultSplitShares) : null, groupId]
    );

    return res.json({ 
      message: 'Group default split settings updated successfully',
      defaultSplitType,
      defaultSplitShares
    });
  } catch (error) {
    console.error('Update default split error:', error);
    return res.status(500).json({ message: 'Error updating default split settings' });
  }
});

export default router;
