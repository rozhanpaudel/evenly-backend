const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Notification = require('../models/notification.model');
const { authenticateUser } = require('../middleware/auth.middleware');

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get user's notifications
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   userId:
 *                     type: string
 *                   message:
 *                     type: string
 *                   type:
 *                     type: string
 *                   groupId:
 *                     type: string
 *                   read:
 *                     type: boolean
 */
router.get('/', authenticateUser, async (req, res) => {
  try {
    const notifications = await Notification.find({ 
      userId: req.user.email 
    })
    .sort({ createdAt: -1 })
    .limit(50);  // Limit to last 50 notifications
    
    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error fetching notifications' 
    });
  }
});

/**
 * @swagger
 * /notifications/{notificationId}/read:
 *   patch:
 *     summary: Mark notification as read
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked as read
 */
router.patch('/:notificationId/read', authenticateUser, async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Invalid notification ID format' 
      });
    }
    
    const notification = await Notification.findById(notificationId);
    
    if (!notification || notification.userId !== req.user.email) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Notification not found' 
      });
    }

    notification.read = true;
    await notification.save();
    
    res.json({ 
      status: 'success',
      message: 'Notification marked as read' 
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error updating notification' 
    });
  }
});

module.exports = router; 