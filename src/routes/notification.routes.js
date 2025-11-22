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
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of notifications to return
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of notifications to skip
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Return only unread notifications
 *     responses:
 *       200:
 *         description: List of notifications with rich data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [success]
 *                 data:
 *                   type: object
 *                   properties:
 *                     notifications:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           title:
 *                             type: string
 *                           message:
 *                             type: string
 *                           type:
 *                             type: string
 *                           actor:
 *                             type: object
 *                             properties:
 *                               email:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                               profilePicture:
 *                                 type: string
 *                           groupInfo:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                               image:
 *                                 type: string
 *                               currency:
 *                                 type: string
 *                           action:
 *                             type: object
 *                             properties:
 *                               type:
 *                                 type: string
 *                               targetId:
 *                                 type: string
 *                           content:
 *                             type: object
 *                             properties:
 *                               amount:
 *                                 type: number
 *                               currency:
 *                                 type: string
 *                               share:
 *                                 type: number
 *                               description:
 *                                 type: string
 *                               image:
 *                                 type: string
 *                           read:
 *                             type: boolean
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                     unreadCount:
 *                       type: integer
 *                     totalCount:
 *                       type: integer
 */
router.get('/', authenticateUser, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const skip = parseInt(req.query.skip) || 0;
    const unreadOnly = req.query.unreadOnly === 'true';

    // Build query
    const query = { userId: req.user.email };
    if (unreadOnly) {
      query.read = false;
    }

    // Get notifications
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean(); // Use lean() for better performance

    // Get counts
    const totalCount = await Notification.countDocuments({ userId: req.user.email });
    const unreadCount = await Notification.countDocuments({ 
      userId: req.user.email, 
      read: false 
    });
    
    res.json({
      status: 'success',
      data: {
        notifications,
        unreadCount,
        totalCount
      }
    });
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

/**
 * @swagger
 * /notifications/unread-count:
 *   get:
 *     summary: Get count of unread notifications
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Unread notification count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [success]
 *                 data:
 *                   type: object
 *                   properties:
 *                     unreadCount:
 *                       type: integer
 */
router.get('/unread-count', authenticateUser, async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({ 
      userId: req.user.email, 
      read: false 
    });
    
    res.json({
      status: 'success',
      data: {
        unreadCount
      }
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error fetching unread count' 
    });
  }
});

/**
 * @swagger
 * /notifications/mark-all-read:
 *   patch:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [success]
 *                 data:
 *                   type: object
 *                   properties:
 *                     updatedCount:
 *                       type: integer
 */
router.patch('/mark-all-read', authenticateUser, async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { 
        userId: req.user.email,
        read: false 
      },
      { 
        $set: { read: true } 
      }
    );
    
    res.json({ 
      status: 'success',
      data: {
        updatedCount: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error updating notifications' 
    });
  }
});

module.exports = router; 