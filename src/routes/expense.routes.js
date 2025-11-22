const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Expense = require('../models/expense.model');
const Group = require('../models/group.model');
const { authenticateUser } = require('../middleware/auth.middleware');
const { createNotification } = require('../services/notification.service');
const Settlement = require('../models/settlement.model');
const User = require('../models/user.model');
const { upload } = require('../middleware/upload.middleware');
const { uploadFile, getExpenseReceiptFolder } = require('../utils/upload.util');

/**
 * @swagger
 * tags:
 *   name: Expenses
 *   description: Expense management and calculations
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Expense:
 *       type: object
 *       required:
 *         - groupId
 *         - amount
 *         - description
 *         - date
 *         - paidBy
 *         - splitAmong
 *       properties:
 *         groupId:
 *           type: string
 *           description: The ID of the group
 *         amount:
 *           type: number
 *           description: The expense amount
 *         description:
 *           type: string
 *           description: Description of the expense
 *         date:
 *           type: string
 *           format: date
 *           description: Date of the expense
 *         paidBy:
 *           type: string
 *           description: Email of the user who paid
 *         splitAmong:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of user emails among whom the expense is split
 *         invoice:
 *           type: string
 *           description: URL of the invoice image
 *     ExpenseShare:
 *       type: object
 *       properties:
 *         user:
 *           type: object
 *           properties:
 *             email:
 *               type: string
 *             name:
 *               type: string
 *             profilePicture:
 *               type: string
 *         amount:
 *           type: number
 *     ExpenseDetail:
 *       allOf:
 *         - $ref: '#/components/schemas/Expense'
 *         - type: object
 *           properties:
 *             paidByUser:
 *               type: object
 *               properties:
 *                 email:
 *                   type: string
 *                 name:
 *                   type: string
 *                 profilePicture:
 *                   type: string
 *             shares:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ExpenseShare'
 *             group:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 currency:
 *                   type: string
 */

/**
 * @swagger
 * /expenses/create:
 *   post:
 *     summary: Create a new expense with optional receipt/bill upload
 *     tags: [Expenses]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - groupId
 *               - amount
 *               - description
 *               - date
 *               - splitAmong
 *             properties:
 *               groupId:
 *                 type: string
 *               amount:
 *                 type: number
 *               description:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *               splitAmong:
 *                 type: array
 *                 items:
 *                   type: string
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Optional receipt/bill image (field name must be 'image')
 *     responses:
 *       201:
 *         description: Expense created successfully
 */
router.post('/create', authenticateUser, upload, async (req, res) => {
  try {
    const { groupId, amount, description, date, splitAmong } = req.body;
    let invoice = null;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Invalid group ID format' 
      });
    }
    
    // Parse and validate amount
    const amountNum = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Amount must be a positive number' 
      });
    }
    
    // Parse splitAmong if it's a string (from multipart/form-data)
    let splitAmongArray;
    try {
      splitAmongArray = typeof splitAmong === 'string' ? JSON.parse(splitAmong) : splitAmong;
    } catch (error) {
      splitAmongArray = Array.isArray(splitAmong) ? splitAmong : [];
    }
    
    // Validate splitAmong
    if (!splitAmongArray || !Array.isArray(splitAmongArray) || splitAmongArray.length === 0) {
      return res.status(400).json({ 
        status: 'error',
        message: 'splitAmong must be a non-empty array' 
      });
    }
    
    // Validate all splitAmong are valid emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = splitAmongArray.filter(email => !emailRegex.test(email));
    if (invalidEmails.length > 0) {
      return res.status(400).json({ 
        status: 'error',
        message: 'All emails in splitAmong must be valid email addresses' 
      });
    }
    
    // Validate description
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Description is required' 
      });
    }
    
    // Validate date
    if (!date || isNaN(Date.parse(date))) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Valid date is required' 
      });
    }
    
    // Verify group exists and user is a member
    const group = await Group.findById(groupId);
    if (!group || !group.members.includes(req.user.email)) {
      return res.status(403).json({ 
        status: 'error',
        message: 'Access denied' 
      });
    }

    // Upload receipt/bill if provided
    if (req.file) {
      // Validate file size
      if (req.file.size > 5 * 1024 * 1024) {
        return res.status(400).json({
          status: 'error',
          message: 'File size too large. Maximum size is 5MB'
        });
      }

      try {
        const folder = getExpenseReceiptFolder(groupId);
        invoice = await uploadFile(req.file, folder);
      } catch (error) {
        console.error('Receipt upload error:', error);
        return res.status(500).json({
          status: 'error',
          message: 'Error uploading receipt: ' + error.message
        });
      }
    }

    const expense = new Expense({
      groupId,
      amount: amountNum,
      description,
      date,
      paidBy: req.user.email,
      splitAmong: splitAmongArray,
      invoice
    });

    await expense.save();

    // Create detailed notifications for all members (with push and email)
    const notificationPromises = group.members
      .filter(email => email !== req.user.email)
      .map(email => {
        const isInSplit = splitAmongArray.includes(email);
        const share = isInSplit ? amountNum / splitAmongArray.length : 0;
        
        let message;
        if (isInSplit) {
          // For members who need to pay
          message = `${req.user.name} added an expense of ${group.currency} ${amountNum} in ${group.name}. Your share: ${group.currency} ${share.toFixed(2)}`;
        } else {
          // For members who are not part of the split
          message = `${req.user.name} added an expense of ${group.currency} ${amountNum} in ${group.name}`;
        }
        
        return createNotification(
          email,
          message,
          'expense_added',
          groupId,
          {
            expenseId: expense._id.toString(),
            amount: amountNum,
            share,
            paidBy: req.user.email,
            description,
            image: invoice || null
          },
          {
            title: 'New Expense Added',
            actor: {
              email: req.user.email,
              name: req.user.name,
              profilePicture: req.user.profilePicture || null
            },
            expenseData: {
              userName: req.user.name,
              groupName: group.name,
              amount: amountNum,
              currency: group.currency,
              share,
              description,
              isInSplit,
              image: invoice || null
            }
          }
        );
      });

    await Promise.all(notificationPromises);

    res.status(201).json({
      status: 'success',
      data: {
        expenseId: expense._id,
        message: 'Expense added successfully'
      }
    });
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error creating expense' 
    });
  }
});

/**
 * @swagger
 * /expenses/{groupId}:
 *   get:
 *     summary: Get all expenses and balance calculations for a group
 *     tags: [Expenses]
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
 *         description: List of expenses and balance calculations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 expenses:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Expense'
 *                 settlements:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Settlement'
 *                 balances:
 *                   type: object
 *                   properties:
 *                     totalBalance:
 *                       type: number
 *                     youOwe:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           user:
 *                             type: string
 *                           amount:
 *                             type: number
 *                     youAreOwed:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           user:
 *                             type: string
 *                           amount:
 *                             type: number
 */

/**
 * @swagger
 * /expenses/{groupId}/summary:
 *   get:
 *     summary: Get expense summary statistics for a group
 *     tags: [Expenses]
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
 *         description: Group expense summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalExpenses:
 *                   type: number
 *                 monthlyExpenses:
 *                   type: object
 *                   additionalProperties:
 *                     type: number
 *                 expensesByMember:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       user:
 *                         type: string
 *                       totalPaid:
 *                         type: number
 *                       totalShare:
 *                         type: number
 */
router.get('/:groupId/summary', authenticateUser, async (req, res) => {
  try {
    const { groupId } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Invalid group ID format' 
      });
    }
    
    // Verify group exists and user is a member
    const group = await Group.findById(groupId);
    if (!group || !group.members.includes(req.user.email)) {
      return res.status(403).json({ 
        status: 'error',
        message: 'Access denied' 
      });
    }

    const expenses = await Expense.find({ groupId });
    const summary = calculateExpenseSummary(group.members, expenses);
    
    res.json(summary);
  } catch (error) {
    console.error('Get expense summary error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error fetching expense summary' 
    });
  }
});

router.get('/:groupId', authenticateUser, async (req, res) => {
  try {
    const { groupId } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Invalid group ID format' 
      });
    }
    
    // Verify group exists and user is a member
    const group = await Group.findById(groupId);
    if (!group || !group.members.includes(req.user.email)) {
      return res.status(403).json({ 
        status: 'error',
        message: 'Access denied' 
      });
    }

    // Get all expenses for the group
    const expenses = await Expense.find({ groupId })
      .sort({ date: -1 });

    // Get all settlements for the group
    const settlements = await Settlement.find({ groupId })
      .sort({ date: -1 });

    // Calculate balances
    const balanceCalculations = calculateBalances(
      req.user.email,
      group.members,
      expenses,
      settlements
    );
    
    res.json({
      expenses,
      settlements,
      balances: balanceCalculations
    });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error fetching expenses' 
    });
  }
});

/**
 * @swagger
 * /expenses/{expenseId}:
 *   delete:
 *     summary: Delete an expense
 *     tags: [Expenses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: expenseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Expense deleted successfully
 */
router.delete('/:expenseId', authenticateUser, async (req, res) => {
  try {
    const { expenseId } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(expenseId)) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Invalid expense ID format' 
      });
    }
    
    const expense = await Expense.findById(expenseId);
    if (!expense) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Expense not found' 
      });
    }

    // Verify user is the one who created the expense
    if (expense.paidBy !== req.user.email) {
      return res.status(403).json({ 
        status: 'error',
        message: 'Only the expense creator can delete it' 
      });
    }

    await Expense.findByIdAndDelete(expenseId);
    
    res.json({ 
      status: 'success',
      message: 'Expense deleted successfully' 
    });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error deleting expense' 
    });
  }
});

/**
 * @swagger
 * /expenses/detail/{expenseId}:
 *   get:
 *     summary: Get detailed expense information
 *     tags: [Expenses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: expenseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detailed expense information
 */
router.get('/detail/:expenseId', authenticateUser, async (req, res) => {
  try {
    const { expenseId } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(expenseId)) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Invalid expense ID format' 
      });
    }
    
    const expense = await Expense.findById(expenseId);
    if (!expense) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Expense not found' 
      });
    }

    // Get group to verify membership
    const group = await Group.findById(expense.groupId);
    if (!group || !group.members.includes(req.user.email)) {
      return res.status(403).json({ 
        status: 'error',
        message: 'Access denied' 
      });
    }

    // Get user details for paidBy and splitAmong
    const users = await User.find({
      email: { $in: [expense.paidBy, ...expense.splitAmong] }
    }, 'email name profilePicture');

    const userMap = users.reduce((map, user) => {
      map[user.email] = {
        name: user.name,
        profilePicture: user.profilePicture
      };
      return map;
    }, {});

    // Calculate individual shares
    if (!expense.splitAmong || expense.splitAmong.length === 0 || !expense.amount || expense.amount <= 0) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Expense has invalid splitAmong data' 
      });
    }
    
    const perPersonAmount = expense.amount / expense.splitAmong.length;
    const shares = expense.splitAmong.map(email => ({
      user: {
        email,
        ...userMap[email]
      },
      amount: perPersonAmount
    }));

    res.json({
      ...expense.toObject(),
      paidByUser: {
        email: expense.paidBy,
        ...userMap[expense.paidBy]
      },
      shares,
      group: {
        id: group._id,
        name: group.name,
        currency: group.currency
      }
    });
  } catch (error) {
    console.error('Get expense detail error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error fetching expense details' 
    });
  }
});

// Helper function to calculate balances
function calculateBalances(currentUserEmail, groupMembers, expenses, settlements) {
  // Initialize balance tracking
  const balances = {};
  groupMembers.forEach(member => {
    balances[member] = 0; // Positive means you are owed, negative means you owe
  });

  // Calculate from expenses
  expenses.forEach(expense => {
    // Safety check: skip if splitAmong is empty or amount is invalid
    if (!expense.splitAmong || expense.splitAmong.length === 0 || !expense.amount || expense.amount <= 0) {
      return;
    }
    
    const perPersonAmount = expense.amount / expense.splitAmong.length;
    
    // Calculate what each person owes (excluding the payer)
    const payingMembers = expense.splitAmong.filter(member => member !== expense.paidBy);
    
    // Add amount to person who paid (only from people who are not the payer)
    if (balances[expense.paidBy] !== undefined && payingMembers.length > 0) {
      balances[expense.paidBy] += perPersonAmount * payingMembers.length;
    }
    
    // Subtract from people who need to pay (excluding the payer)
    payingMembers.forEach(member => {
      if (balances[member] !== undefined) {
        balances[member] -= perPersonAmount;
      }
    });
  });

  // Adjust for settlements
  settlements.forEach(settlement => {
    if (balances[settlement.paidBy] !== undefined) {
      balances[settlement.paidBy] += settlement.amount;
    }
    if (balances[settlement.paidTo] !== undefined) {
      balances[settlement.paidTo] -= settlement.amount;
    }
  });

  // Format the output
  const youOwe = [];
  const youAreOwed = [];
  let totalBalance = 0;

  Object.entries(balances).forEach(([member, amount]) => {
    if (member === currentUserEmail) {
      totalBalance = amount;
    } else if (amount > 0) {
      // Current user owes this person
      youOwe.push({
        user: member,
        amount: Math.abs(amount)
      });
    } else if (amount < 0) {
      // This person owes the current user
      youAreOwed.push({
        user: member,
        amount: Math.abs(amount)
      });
    }
  });

  return {
    totalBalance,
    youOwe: youOwe.sort((a, b) => b.amount - a.amount),
    youAreOwed: youAreOwed.sort((a, b) => b.amount - a.amount)
  };
}

// Helper function to calculate expense summary
function calculateExpenseSummary(groupMembers, expenses) {
  const summary = {
    totalExpenses: 0,
    monthlyExpenses: {},
    expensesByMember: []
  };

  const memberStats = {};
  groupMembers.forEach(member => {
    memberStats[member] = {
      totalPaid: 0,
      totalShare: 0
    };
  });

  expenses.forEach(expense => {
    // Safety check: skip if amount is invalid
    if (!expense.amount || expense.amount <= 0) {
      return;
    }
    
    // Calculate total expenses
    summary.totalExpenses += expense.amount;

    // Calculate monthly expenses
    const monthYear = new Date(expense.date).toISOString().slice(0, 7); // YYYY-MM
    summary.monthlyExpenses[monthYear] = (summary.monthlyExpenses[monthYear] || 0) + expense.amount;

    // Calculate member statistics
    if (memberStats[expense.paidBy]) {
      memberStats[expense.paidBy].totalPaid += expense.amount;
    }
    
    // Safety check: skip if splitAmong is empty
    if (expense.splitAmong && expense.splitAmong.length > 0) {
      const perPersonShare = expense.amount / expense.splitAmong.length;
      expense.splitAmong.forEach(member => {
        if (memberStats[member]) {
          memberStats[member].totalShare += perPersonShare;
        }
      });
    }
  });

  // Format member statistics
  summary.expensesByMember = Object.entries(memberStats).map(([user, stats]) => ({
    user,
    ...stats
  }));

  return summary;
}

module.exports = router; 