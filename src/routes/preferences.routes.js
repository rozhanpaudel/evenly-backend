const express = require('express');
const router = express.Router();
const UserPreferences = require('../models/userPreferences.model');
const { authenticateUser } = require('../middleware/auth.middleware');

/**
 * @swagger
 * /preferences:
 *   get:
 *     summary: Get user preferences
 *     tags: [Preferences]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User preferences
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
 *                     email:
 *                       type: string
 *                     notifications:
 *                       type: object
 *                       properties:
 *                         email:
 *                           type: boolean
 *                         push:
 *                           type: boolean
 *                     theme:
 *                       type: string
 *                       enum: [light, dark, system]
 *                     currency:
 *                       type: object
 *                       properties:
 *                         default:
 *                           type: string
 *                         displayFormat:
 *                           type: string
 *                           enum: [symbol, code, name]
 *                     language:
 *                       type: string
 *                     dateFormat:
 *                       type: string
 *                     timeFormat:
 *                       type: string
 *                       enum: [12h, 24h]
 *                     privacy:
 *                       type: object
 *                     app:
 *                       type: object
 */
router.get('/', authenticateUser, async (req, res) => {
  try {
    let preferences = await UserPreferences.findOne({ email: req.user.email });
    
    // Create default preferences if they don't exist
    if (!preferences) {
      preferences = new UserPreferences({ email: req.user.email });
      await preferences.save();
    }
    
    res.json({
      status: 'success',
      data: preferences
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching preferences'
    });
  }
});

/**
 * @swagger
 * /preferences:
 *   patch:
 *     summary: Update user preferences
 *     tags: [Preferences]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notifications:
 *                 type: object
 *                 properties:
 *                   email:
 *                     type: boolean
 *                   push:
 *                     type: boolean
 *               theme:
 *                 type: string
 *                 enum: [light, dark, system]
 *               currency:
 *                 type: object
 *                 properties:
 *                   default:
 *                     type: string
 *                   displayFormat:
 *                     type: string
 *                     enum: [symbol, code, name]
 *               language:
 *                 type: string
 *               dateFormat:
 *                 type: string
 *                 enum: [MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD]
 *               timeFormat:
 *                 type: string
 *                 enum: [12h, 24h]
 *               privacy:
 *                 type: object
 *                 properties:
 *                   showEmail:
 *                     type: boolean
 *                   showProfilePicture:
 *                     type: boolean
 *               app:
 *                 type: object
 *                 properties:
 *                   autoBackup:
 *                     type: boolean
 *                   biometricAuth:
 *                     type: boolean
 *     responses:
 *       200:
 *         description: Preferences updated successfully
 *       400:
 *         description: Invalid input
 */
router.patch('/', authenticateUser, async (req, res) => {
  try {
    let preferences = await UserPreferences.findOne({ email: req.user.email });
    
    // Create preferences if they don't exist
    if (!preferences) {
      preferences = new UserPreferences({ email: req.user.email });
    }
    
    // Update only provided fields
    const allowedFields = [
      'notifications',
      'theme',
      'currency',
      'language',
      'dateFormat',
      'timeFormat',
      'privacy',
      'app'
    ];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (typeof req.body[field] === 'object' && !Array.isArray(req.body[field])) {
          // Merge nested objects
          preferences[field] = {
            ...preferences[field],
            ...req.body[field]
          };
        } else {
          preferences[field] = req.body[field];
        }
      }
    });
    
    await preferences.save();
    
    res.json({
      status: 'success',
      data: preferences,
      message: 'Preferences updated successfully'
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid preference values',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }
    
    res.status(500).json({
      status: 'error',
      message: 'Error updating preferences'
    });
  }
});

/**
 * @swagger
 * /preferences/notifications:
 *   patch:
 *     summary: Update notification preferences only
 *     tags: [Preferences]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: boolean
 *               push:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Notification preferences updated
 */
router.patch('/notifications', authenticateUser, async (req, res) => {
  try {
    let preferences = await UserPreferences.getOrCreate(req.user.email);
    
    if (req.body.email !== undefined) {
      preferences.notifications.email = req.body.email === true;
    }
    
    if (req.body.push !== undefined) {
      preferences.notifications.push = req.body.push === true;
    }
    
    await preferences.save();
    
    res.json({
      status: 'success',
      data: {
        notifications: preferences.notifications
      },
      message: 'Notification preferences updated'
    });
  } catch (error) {
    console.error('Update notification preferences error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error updating notification preferences'
    });
  }
});

/**
 * @swagger
 * /preferences/theme:
 *   patch:
 *     summary: Update theme preference
 *     tags: [Preferences]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - theme
 *             properties:
 *               theme:
 *                 type: string
 *                 enum: [light, dark, system]
 *     responses:
 *       200:
 *         description: Theme updated
 */
router.patch('/theme', authenticateUser, async (req, res) => {
  try {
    const { theme } = req.body;
    
    if (!theme || !['light', 'dark', 'system'].includes(theme)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid theme. Must be one of: light, dark, system'
      });
    }
    
    let preferences = await UserPreferences.getOrCreate(req.user.email);
    preferences.theme = theme;
    await preferences.save();
    
    res.json({
      status: 'success',
      data: {
        theme: preferences.theme
      },
      message: 'Theme updated'
    });
  } catch (error) {
    console.error('Update theme error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error updating theme'
    });
  }
});

/**
 * @swagger
 * /preferences/currency:
 *   patch:
 *     summary: Update currency preferences
 *     tags: [Preferences]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               default:
 *                 type: string
 *                 example: USD
 *               displayFormat:
 *                 type: string
 *                 enum: [symbol, code, name]
 *     responses:
 *       200:
 *         description: Currency preferences updated
 */
router.patch('/currency', authenticateUser, async (req, res) => {
  try {
    let preferences = await UserPreferences.getOrCreate(req.user.email);
    
    if (req.body.default !== undefined) {
      preferences.currency.default = req.body.default;
    }
    
    if (req.body.displayFormat !== undefined) {
      if (!['symbol', 'code', 'name'].includes(req.body.displayFormat)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid displayFormat. Must be one of: symbol, code, name'
        });
      }
      preferences.currency.displayFormat = req.body.displayFormat;
    }
    
    await preferences.save();
    
    res.json({
      status: 'success',
      data: {
        currency: preferences.currency
      },
      message: 'Currency preferences updated'
    });
  } catch (error) {
    console.error('Update currency preferences error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error updating currency preferences'
    });
  }
});

module.exports = router;

