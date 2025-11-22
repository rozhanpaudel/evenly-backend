const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/user.model');
const { generateToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt.util');
const { authenticateUser } = require('../middleware/auth.middleware');
const { 
  validateSignup, 
  validateLogin, 
  validateProfileUpdate, 
  validate 
} = require('../middleware/validation.middleware');
const { upload } = require('../middleware/upload.middleware');
const { uploadFile } = require('../utils/upload.util');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: User authentication and profile management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - password
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated id of the user
 *         name:
 *           type: string
 *           description: User's full name
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address
 *         password:
 *           type: string
 *           format: password
 *           description: User's password (not returned in responses)
 *         profilePicture:
 *           type: string
 *           format: uri
 *           description: URL of user's profile picture
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Account creation timestamp
 *     AuthResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [success]
 *         data:
 *           type: object
 *           properties:
 *             user:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 profilePicture:
 *                   type: string
 *             accessToken:
 *               type: string
 *               description: JWT access token (expires in 15 minutes)
 *             refreshToken:
 *               type: string
 *               description: JWT refresh token (expires in 7 days)
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [error]
 *         message:
 *           type: string
 */

/**
 * @swagger
 * /auth/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: password123
 *               profilePicture:
 *                 type: string
 *                 format: uri
 *                 example: https://example.com/profile.jpg
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Invalid input or email already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /auth/profile:
 *   get:
 *     summary: Get current user's profile
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
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
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   patch:
 *     summary: Update user profile
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Smith
 *               profilePicture:
 *                 type: string
 *                 format: uri
 *                 example: https://example.com/new-profile.jpg
 *     responses:
 *       200:
 *         description: Profile updated successfully
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
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /auth/google:
 *   post:
 *     summary: Authenticate with Google OAuth
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - credential
 *             properties:
 *               credential:
 *                 type: string
 *                 description: Google ID token from @react-oauth/google
 *     responses:
 *       200:
 *         description: Authentication successful
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
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     accessToken:
 *                       type: string
 *                       description: JWT access token (expires in 15 minutes)
 *                     refreshToken:
 *                       type: string
 *                       description: JWT refresh token (expires in 7 days)
 *       400:
 *         description: Invalid token or missing credential
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token using refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token received from login
 *     responses:
 *       200:
 *         description: Token refreshed successfully
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
 *                     accessToken:
 *                       type: string
 *       401:
 *         description: Invalid refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /auth/upload-profile-picture:
 *   post:
 *     summary: Upload profile picture
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - image
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Profile picture image file to upload
 *     responses:
 *       200:
 *         description: Profile picture uploaded successfully
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
 *                     url:
 *                       type: string
 *                       format: uri
 *                       description: Public URL of the uploaded profile picture
 *                     size:
 *                       type: number
 *                       description: File size in bytes
 *                     type:
 *                       type: string
 *                       description: MIME type of the file
 *       400:
 *         description: Invalid file type or size
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
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

// Register new user
router.post('/signup', validateSignup, validate, async (req, res) => {
  try {
    const { email, password, name, profilePicture } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'Email already registered'
      });
    }

    // Create new user
    const user = new User({
      name,
      email,
      password,
      profilePicture
    });

    await user.save();

    // Generate tokens
    const accessToken = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: {
        user: {
          id: user._id,
          name,
          email,
          profilePicture
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error registering user'
    });
  }
});

// Login user
router.post('/login', validateLogin, validate, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials'
      });
    }

    // Check if user is OAuth-only (no password)
    if (user.authProvider === 'google' || !user.password) {
      return res.status(401).json({
        status: 'error',
        message: 'This account uses Google sign-in. Please use Google to log in.'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials'
      });
    }

    // Generate tokens
    const accessToken = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    res.json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          profilePicture: user.profilePicture
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error during login'
    });
  }
});

// Get current user profile
router.get('/profile', authenticateUser, async (req, res) => {
  try {
    res.json({
      status: 'success',
      data: {
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          profilePicture: req.user.profilePicture
        }
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching user profile'
    });
  }
});

// Update user profile
router.patch('/profile', authenticateUser, validateProfileUpdate, validate, async (req, res) => {
  try {
    const { name, profilePicture } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, profilePicture },
      { new: true }
    );

    res.json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          profilePicture: user.profilePicture
        }
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error updating user profile'
    });
  }
});

// Upload profile picture
router.post(
  '/upload-profile-picture',
  authenticateUser,
  upload,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          status: 'error',
          message: 'No image file provided'
        });
      }

      // Validate file size again (redundant but safe)
      if (req.file.size > 5 * 1024 * 1024) {
        return res.status(400).json({
          status: 'error',
          message: 'File size too large. Maximum size is 5MB'
        });
      }

      const imageUrl = await uploadFile(req.file, 'profiles');

      res.json({
        status: 'success',
        data: {
          url: imageUrl,
          size: req.file.size,
          type: req.file.mimetype
        }
      });
    } catch (error) {
      console.error('Profile picture upload error:', error);
      res.status(500).json({
        status: 'error',
        message: error.message || 'Error uploading profile picture'
      });
    }
  }
);

// Google OAuth authentication
// Note: For ID token verification (from @react-oauth/google), we only need CLIENT_ID, not CLIENT_SECRET.
// The google-auth-library uses Google's public keys to verify the token signature.
// CLIENT_SECRET is only needed for server-side OAuth flow (authorization code exchange).
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        status: 'error',
        message: 'Google credential is required'
      });
    }

    // Validate that GOOGLE_CLIENT_ID is configured
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({
        status: 'error',
        message: 'Google OAuth is not configured'
      });
    }

    // Initialize Google OAuth client (only CLIENT_ID needed for ID token verification)
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    // Verify the ID token
    // This uses Google's public keys to verify the token signature and expiration
    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID // Ensures token was issued for our app
      });
    } catch (error) {
      console.error('Google token verification error:', error);
      return res.status(400).json({
        status: 'error',
        message: 'Invalid Google token'
      });
    }

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      return res.status(400).json({
        status: 'error',
        message: 'Email not provided by Google'
      });
    }

    // Find or create user
    let user = await User.findOne({ 
      $or: [
        { email },
        { googleId }
      ]
    });

    if (user) {
      // Update user if they're logging in with Google for the first time
      if (!user.googleId) {
        user.googleId = googleId;
        user.authProvider = 'google';
        if (!user.profilePicture && picture) {
          user.profilePicture = picture;
        }
        await user.save();
      } else if (picture && user.profilePicture !== picture) {
        // Update profile picture if it changed
        user.profilePicture = picture;
        await user.save();
      }
    } else {
      // Create new user
      user = new User({
        email,
        name: name || email.split('@')[0],
        profilePicture: picture || null,
        googleId,
        authProvider: 'google',
        password: null // OAuth users don't have passwords
      });
      await user.save();
    }

    // Generate tokens
    const accessToken = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    res.json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          profilePicture: user.profilePicture
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Google OAuth error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error during Google authentication'
    });
  }
});

// Refresh access token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        status: 'error',
        message: 'Refresh token is required'
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);
    
    // Verify user still exists
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Generate new access token
    const accessToken = generateToken(user._id);

    res.json({
      status: 'success',
      data: {
        accessToken
      }
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({
      status: 'error',
      message: 'Invalid or expired refresh token'
    });
  }
});

/**
 * @swagger
 * /auth/fcm-token:
 *   post:
 *     summary: Register or update FCM token for push notifications
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fcmToken
 *             properties:
 *               fcmToken:
 *                 type: string
 *                 description: Firebase Cloud Messaging token
 *     responses:
 *       200:
 *         description: FCM token registered successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/fcm-token', authenticateUser, async (req, res) => {
  try {
    const { fcmToken } = req.body;

    if (!fcmToken || typeof fcmToken !== 'string') {
      return res.status(400).json({
        status: 'error',
        message: 'FCM token is required'
      });
    }

    req.user.fcmToken = fcmToken;
    await req.user.save();

    res.json({
      status: 'success',
      message: 'FCM token registered successfully'
    });
  } catch (error) {
    console.error('FCM token registration error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error registering FCM token'
    });
  }
});

module.exports = router; 