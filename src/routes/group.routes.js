const express = require('express');
const router = express.Router();
const Group = require('../models/group.model');
const { authenticateUser } = require('../middleware/auth.middleware');

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
 *     summary: Create a new group
 *     tags: [Groups]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - currency
 *               - members
 *             properties:
 *               name:
 *                 type: string
 *                 example: Weekend Trip
 *               image:
 *                 type: string
 *                 format: uri
 *               currency:
 *                 type: string
 *                 example: USD
 *               members:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: email
 *                 example: ["john@example.com", "jane@example.com"]
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

// Create a new group
router.post('/create', authenticateUser, async (req, res) => {
  try {
    const { name, image, currency, members } = req.body;
    
    // Add the creator to members if not included
    if (!members.includes(req.user.uid)) {
      members.push(req.user.email);
    }

    const group = new Group({
      name,
      image,
      currency,
      members
    });

    await group.save();

    res.status(201).json({
      groupId: group._id,
      message: 'Group created successfully'
    });
  } catch (error) {
    console.error('Group creation error:', error);
    res.status(500).json({ error: 'Error creating group' });
  }
});

// Get specific group
router.get('/:groupId', authenticateUser, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user is a member of the group
    if (!group.members.includes(req.user.email)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(group);
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ error: 'Error fetching group' });
  }
});

// Get all groups for user
router.get('/', authenticateUser, async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user.uid });
    res.json(groups);
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ error: 'Error fetching groups' });
  }
});

module.exports = router; 