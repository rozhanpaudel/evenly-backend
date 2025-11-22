const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: String,  // email
    required: true,
    index: true // Index for faster queries
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['expense_added', 'settlement_received', 'settlement_recorded'],
    required: true,
    index: true
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    index: true
  },
  // Actor information (who performed the action)
  actor: {
    email: String,
    name: String,
    profilePicture: String
  },
  // Group information for context
  groupInfo: {
    name: String,
    image: String,
    currency: String
  },
  // Action data for navigation
  action: {
    type: {
      type: String,
      enum: ['view_expense', 'view_group', 'view_settlement', 'none']
    },
    targetId: String // expenseId, groupId, or settlementId
  },
  // Rich content for display
  content: {
    amount: Number,
    currency: String,
    share: Number, // For expense notifications
    description: String,
    image: String // Receipt image or group image
  },
  // Additional metadata
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

module.exports = mongoose.model('Notification', notificationSchema); 