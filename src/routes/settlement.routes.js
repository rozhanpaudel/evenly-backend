const express = require('express');
const router = express.Router();
const Settlement = require('../models/settlement.model');
const Group = require('../models/group.model');
const { authenticateUser } = require('../middleware/auth.middleware');
const User = require('../models/user.model');
const { createNotification } = require('../services/notification.service');

/**
 * @swagger
 * components:
 *   schemas:
 *     Settlement:
 *       type: object
 *       required:
 *         - groupId
 *         - paidTo
 *         - amount
 *         - date
 *       properties:
 *         groupId:
 *           type: string
 *           description: The ID of the group
 *         paidBy:
 *           type: string
 *           description: Email of the user who paid
 *         paidTo:
 *           type: string
 *           description: Email of the user who received the payment
 *         amount:
 *           type: number
 *           description: The settlement amount
 *         date:
 *           type: string
 *           format: date
 *           description: Date of the settlement
 */

/**
 * @swagger
 * /settlements/create:
 *   post:
 *     summary: Create a new settlement
 *     tags: [Settlements]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Settlement'
 *     responses:
 *       201:
 *         description: Settlement created successfully
 */

/**
 * @swagger
 * /settlements/{groupId}:
 *   get:
 *     summary: Get all settlements for a group
 *     tags: [Settlements]
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
 *         description: List of settlements
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Settlement'
 */

// Create settlement
router.post('/create', authenticateUser, async (req, res) => {
  try {
    const { groupId, paidTo, amount, date } = req.body;
    
    // Verify group exists and both users are members
    const group = await Group.findById(groupId);
    if (!group || !group.members.includes(req.user.email) || !group.members.includes(paidTo)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const settlement = new Settlement({
      groupId,
      paidBy: req.user.email,
      paidTo,
      amount,
      date
    });

    await settlement.save();

    // Create notifications for both parties and group members
    const paidToUser = await User.findOne({ email: paidTo });
    const notificationPromises = [];

    // Notification for the person receiving the payment
    notificationPromises.push(
      createNotification(
        paidTo,
        `${req.user.name} marked a settlement payment of ${group.currency} ${amount} to you in ${group.name}`,
        'settlement_received',
        groupId,
        {
          settlementId: settlement._id,
          amount,
          paidBy: req.user.email
        }
      )
    );

    // Notify other group members
    group.members
      .filter(email => email !== req.user.email && email !== paidTo)
      .forEach(email => {
        notificationPromises.push(
          createNotification(
            email,
            `${req.user.name} settled ${group.currency} ${amount} with ${paidToUser.name} in ${group.name}`,
            'settlement_recorded',
            groupId,
            {
              settlementId: settlement._id,
              amount,
              paidBy: req.user.email,
              paidTo
            }
          )
        );
      });

    await Promise.all(notificationPromises);

    res.status(201).json({
      settlementId: settlement._id,
      message: 'Settlement recorded successfully'
    });
  } catch (error) {
    console.error('Create settlement error:', error);
    res.status(500).json({ error: 'Error creating settlement' });
  }
});

// Get settlements for a group
router.get('/:groupId', authenticateUser, async (req, res) => {
  try {
    const { groupId } = req.params;
    
    // Verify group exists and user is a member
    const group = await Group.findById(groupId);
    if (!group || !group.members.includes(req.user.email)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const settlements = await Settlement.find({ groupId })
      .sort({ date: -1 });
    
    res.json(settlements);
  } catch (error) {
    console.error('Get settlements error:', error);
    res.status(500).json({ error: 'Error fetching settlements' });
  }
});

module.exports = router; 