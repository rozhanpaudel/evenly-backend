const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Group = require('../models/group.model');
const { authenticateUser } = require('../middleware/auth.middleware');
const { upload } = require('../middleware/upload.middleware');
const { uploadFile, getGroupImageFolder } = require('../utils/upload.util');

/**
 * @swagger
 * tags:
 *   name: Groups
 *   description: Group management and operations
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Group:
 *       type: object
 *       required:
 *         - name
 *         - currency
 *         - members
 *       properties:
 *         id:
 *           type: string
 *           description: Auto-generated group ID
 *         name:
 *           type: string
 *           description: Name of the group
 *         image:
 *           type: string
 *           format: uri
 *           description: URL of the group image
 *         currency:
 *           type: string
 *           description: Currency used for expenses in the group
 *           example: USD
 *         category:
 *           type: string
 *           enum: [personal, work, travel, food, entertainment, sports, others]
 *           description: Category of the group
 *           example: travel
 *         members:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of member email addresses
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Group creation timestamp
 */

/**
 * @swagger
 * /groups/create:
 *   post:
 *     summary: Create a new group with optional group image upload
 *     tags: [Groups]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - currency
 *               - category
 *               - members
 *             properties:
 *               name:
 *                 type: string
 *                 example: Weekend Trip
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Optional group image file
 *               currency:
 *                 type: string
 *                 example: USD
 *               category:
 *                 type: string
 *                 enum: [personal, work, travel, food, entertainment, sports, others]
 *                 example: travel
 *                 description: Group category
 *               members:
 *                 type: string
 *                 description: JSON array string of member emails
 *                 example: '["john@example.com", "jane@example.com"]'
 *     responses:
 *       201:
 *         description: Group created successfully
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
 *                     groupId:
 *                       type: string
 *                     message:
 *                       type: string
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /groups/{groupId}:
 *   get:
 *     summary: Get specific group details
 *     tags: [Groups]
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
 *         description: Group details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Group'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied - Not a member of the group
 *       404:
 *         description: Group not found
 */

/**
 * @swagger
 * /groups:
 *   get:
 *     summary: Get all groups for current user
 *     tags: [Groups]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of groups
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Group'
 *       401:
 *         description: Unauthorized
 */

// Valid group categories
const GROUP_CATEGORIES = ['personal', 'work', 'travel', 'food', 'entertainment', 'sports', 'others'];

// Create a new group
router.post('/create', authenticateUser, upload, async (req, res) => {
  try {
    const { name, currency, category, members } = req.body;
    let image = null;
    
    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Group name is required' 
      });
    }
    
    if (!currency || typeof currency !== 'string' || currency.trim().length === 0) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Currency is required' 
      });
    }
    
    // Validate category
    const validCategory = category || 'others'; // Default to 'others' if not provided
    if (!GROUP_CATEGORIES.includes(validCategory)) {
      return res.status(400).json({ 
        status: 'error',
        message: `Invalid category. Must be one of: ${GROUP_CATEGORIES.join(', ')}` 
      });
    }
    
    // Parse members if it's a string (from multipart/form-data)
    let membersArray;
    try {
      membersArray = typeof members === 'string' ? JSON.parse(members) : members;
    } catch (error) {
      membersArray = Array.isArray(members) ? members : [];
    }
    
    // Validate members array
    if (!membersArray || !Array.isArray(membersArray) || membersArray.length === 0) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Members must be a non-empty array' 
      });
    }
    
    // Validate all members are valid emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = membersArray.filter(email => !emailRegex.test(email));
    if (invalidEmails.length > 0) {
      return res.status(400).json({ 
        status: 'error',
        message: 'All members must be valid email addresses' 
      });
    }
    
    // Add the creator to members if not included
    if (!membersArray.includes(req.user.email)) {
      membersArray.push(req.user.email);
    }

    // Create group first to get the ID
    const group = new Group({
      name,
      image: null, // Will be updated after upload
      currency,
      category: validCategory,
      members: membersArray
    });

    await group.save();

    // Upload group image if provided (after group is created to get the ID)
    if (req.file) {
      // Validate file size
      if (req.file.size > 5 * 1024 * 1024) {
        // Delete the group if image upload fails validation
        try {
          await Group.findByIdAndDelete(group._id);
        } catch (deleteError) {
          console.error('Error deleting group after file size validation failure:', deleteError);
        }
        return res.status(400).json({
          status: 'error',
          message: 'File size too large. Maximum size is 5MB'
        });
      }

      try {
        const folder = getGroupImageFolder(group._id.toString());
        image = await uploadFile(req.file, folder);
        
        // Update group with image URL
        group.image = image;
        await group.save();
      } catch (error) {
        console.error('Group image upload error:', error);
        // Delete the group if image upload fails
        try {
          await Group.findByIdAndDelete(group._id);
        } catch (deleteError) {
          console.error('Error deleting group after image upload failure:', deleteError);
        }
        return res.status(500).json({
          status: 'error',
          message: 'Error uploading group image: ' + error.message
        });
      }
    }

    res.status(201).json({
      status: 'success',
      data: {
        groupId: group._id,
        message: 'Group created successfully'
      }
    });
  } catch (error) {
    console.error('Group creation error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error creating group' 
    });
  }
});

// Get specific group
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
    
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Group not found' 
      });
    }

    // Check if user is a member of the group
    if (!group.members.includes(req.user.email)) {
      return res.status(403).json({ 
        status: 'error',
        message: 'Access denied' 
      });
    }

    res.json(group);
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error fetching group' 
    });
  }
});

// Get all groups for user
router.get('/', authenticateUser, async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user.email });
    res.json(groups);
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error fetching groups' 
    });
  }
});

/**
 * @swagger
 * /groups/categories:
 *   get:
 *     summary: Get all available group categories
 *     tags: [Groups]
 *     responses:
 *       200:
 *         description: List of available categories
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [success]
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       key:
 *                         type: string
 *                       label:
 *                         type: string
 *                       icon:
 *                         type: string
 *                       color:
 *                         type: string
 */
router.get('/categories', (req, res) => {
  const categories = [
    { key: 'personal', label: 'Personal', icon: 'home', color: '#1CC29F' },
    { key: 'work', label: 'Work', icon: 'briefcase', color: '#FF6B6B' },
    { key: 'travel', label: 'Travel', icon: 'airplane', color: '#4ECDC4' },
    { key: 'food', label: 'Food', icon: 'restaurant', color: '#FFB84D' },
    { key: 'entertainment', label: 'Fun', icon: 'game-controller', color: '#A78BFA' },
    { key: 'sports', label: 'Sports', icon: 'basketball', color: '#F97316' },
    { key: 'others', label: 'Others', icon: 'ellipsis-horizontal', color: '#9CA3AF' },
  ];
  
  res.json({
    status: 'success',
    data: categories
  });
});

module.exports = router; 