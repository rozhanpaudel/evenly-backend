const Notification = require('../models/notification.model');

const createNotification = async (userId, message, type, groupId = null, details = {}) => {
  try {
    const notification = new Notification({
      userId,
      message,
      type,
      groupId,
      details
    });
    
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Create notification error:', error);
    throw error;
  }
};

module.exports = { createNotification }; 