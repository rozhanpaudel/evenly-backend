const express = require('express');
const router = express.Router();
const Expense = require('../models/expense.model');
const Settlement = require('../models/settlement.model');
const Group = require('../models/group.model');
const { authenticateUser } = require('../middleware/auth.middleware');

/**
 * @swagger
 * /balances/{groupId}:
 *   get:
 *     summary: Get balances for a specific group
 *     tags: [Balances]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Group balance details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 balances:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       email:
 *                         type: string
 *                       owedAmount:
 *                         type: number
 *                       owesAmount:
 *                         type: number
 */

/**
 * @swagger
 * /balances/user/owe:
 *   get:
 *     summary: Get total amount user owes to others
 *     tags: [Balances]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User's owe details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalAmount:
 *                   type: number
 *                 oweDetails:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       groupId:
 *                         type: string
 *                       owedTo:
 *                         type: string
 *                       amount:
 *                         type: number
 */

// Get balances for a specific group
router.get('/:groupId', authenticateUser, async (req, res) => {
  try {
    const { groupId } = req.params;
    
    // Verify group exists and user is a member
    const group = await Group.findById(groupId);

    if (!group || !group.members.includes(req.user.email)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all expenses for the group
    const expenses = await Expense.find({ groupId });
    
    // Get all settlements for the group
    const settlements = await Settlement.find({ groupId });

    // Calculate balances
    const balances = calculateGroupBalances(group.members, expenses, settlements);
    
    res.json({ balances });
  } catch (error) {
    console.error('Get balances error:', error);
    res.status(500).json({ error: 'Error fetching balances' });
  }
});

// Get total amount user owes to others
router.get('/user/owe', authenticateUser, async (req, res) => {
  try {
    // Get all groups user is member of
    const groups = await Group.find({ members: req.user.email });
    const groupIds = groups.map(group => group._id);

    // Get all expenses where user is in splitAmong
    const expenses = await Expense.find({
      groupId: { $in: groupIds },
      splitAmong: req.user.email
    });

    // Get all settlements
    const settlements = await Settlement.find({
      groupId: { $in: groupIds },
      $or: [{ paidBy: req.user.email }, { paidTo: req.user.email }]
    });

    const oweDetails = calculateUserOwes(req.user.email, expenses, settlements, groups);
    
    res.json(oweDetails);
  } catch (error) {
    console.error('Get user owe error:', error);
    res.status(500).json({ error: 'Error calculating amounts owed' });
  }
});

// Helper function to calculate group balances
function calculateGroupBalances(members, expenses, settlements) {
  const balances = {};
  
  // Initialize balances for all members
  members.forEach(member => {
    balances[member] = { owedAmount: 0, owesAmount: 0 };
  });

  // Calculate from expenses
  expenses.forEach(expense => {
    // Safety check: skip if splitAmong is empty
    if (!expense.splitAmong || expense.splitAmong.length === 0) {
      return;
    }
    
    const perPersonAmount = expense.amount / expense.splitAmong.length;
    
    expense.splitAmong.forEach(member => {
      if (member !== expense.paidBy && balances[member]) {
        balances[member].owesAmount += perPersonAmount;
        if (balances[expense.paidBy]) {
          balances[expense.paidBy].owedAmount += perPersonAmount;
        }
      }
    });
  });

  // Adjust for settlements
  settlements.forEach(settlement => {
    if (balances[settlement.paidBy]) {
      balances[settlement.paidBy].owedAmount -= settlement.amount;
    }
    if (balances[settlement.paidTo]) {
      balances[settlement.paidTo].owesAmount -= settlement.amount;
    }
  });

  return Object.entries(balances).map(([email, balance]) => ({
    email,
    ...balance
  }));
}

// Helper function to calculate what user owes
function calculateUserOwes(userId, expenses, settlements, groups) {
  const oweDetails = {
    totalAmount: 0,
    oweDetails: []
  };

  const owedByGroup = {};

  // Calculate from expenses
  expenses.forEach(expense => {
    // Safety check: skip if splitAmong is empty
    if (!expense.splitAmong || expense.splitAmong.length === 0) {
      return;
    }
    
    if (expense.splitAmong.includes(userId) && expense.paidBy !== userId) {
      const perPersonAmount = expense.amount / expense.splitAmong.length;
      const groupId = expense.groupId.toString();
      
      if (!owedByGroup[groupId]) {
        owedByGroup[groupId] = {};
      }
      
      if (!owedByGroup[groupId][expense.paidBy]) {
        owedByGroup[groupId][expense.paidBy] = 0;
      }
      
      owedByGroup[groupId][expense.paidBy] += perPersonAmount;
    }
  });

  // Adjust for settlements
  settlements.forEach(settlement => {
    const groupId = settlement.groupId.toString();
    
    if (settlement.paidBy === userId) {
      if (owedByGroup[groupId] && owedByGroup[groupId][settlement.paidTo]) {
        owedByGroup[groupId][settlement.paidTo] -= settlement.amount;
      }
    }
  });

  // Format the output
  Object.entries(owedByGroup).forEach(([groupId, owedToUsers]) => {
    Object.entries(owedToUsers).forEach(([owedTo, amount]) => {
      if (amount > 0) {
        oweDetails.oweDetails.push({
          groupId,
          owedTo,
          amount
        });
        oweDetails.totalAmount += amount;
      }
    });
  });

  return oweDetails;
}

module.exports = router; 