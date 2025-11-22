const Notification = require('../models/notification.model');
const User = require('../models/user.model');
const UserPreferences = require('../models/userPreferences.model');
const Group = require('../models/group.model');
const { sendPushNotification } = require('./push.service');
const { sendExpenseNotificationEmail, sendSettlementNotificationEmail, sendEmail } = require('./email.service');

/**
 * Create notification and send push/email notifications
 * @param {String} userId - User email
 * @param {String} message - Notification message
 * @param {String} type - Notification type
 * @param {String} groupId - Group ID
 * @param {Object} details - Additional details
 * @param {Object} options - Options for push/email notifications
 * @returns {Promise<Object>} - Created notification
 */
const createNotification = async (userId, message, type, groupId = null, details = {}, options = {}) => {
  try {
    // Get actor information (user who triggered the notification)
    let actor = options.actor || {};
    
    // If actor email is provided but name/picture missing, fetch from User model
    if (actor.email && (!actor.name || !actor.profilePicture)) {
      const actorUser = await User.findOne({ email: actor.email }).select('name profilePicture');
      if (actorUser) {
        actor = {
          email: actor.email,
          name: actor.name || actorUser.name,
          profilePicture: actor.profilePicture || actorUser.profilePicture || null
        };
      }
    }
    
    // Get group information if groupId is provided
    let groupInfo = null;
    if (groupId) {
      const group = await Group.findById(groupId).select('name image currency');
      if (group) {
        groupInfo = {
          name: group.name,
          image: group.image || null,
          currency: group.currency
        };
      }
    }

    // Determine action type and target
    let actionType = 'none';
    let targetId = null;
    
    if (type === 'expense_added' && details.expenseId) {
      actionType = 'view_expense';
      targetId = details.expenseId;
    } else if (type === 'settlement_received' || type === 'settlement_recorded') {
      if (details.settlementId) {
        actionType = 'view_settlement';
        targetId = details.settlementId;
      } else if (groupId) {
        actionType = 'view_group';
        targetId = groupId.toString();
      }
    } else if (groupId) {
      actionType = 'view_group';
      targetId = groupId.toString();
    }

    // Prepare content for rich display
    const content = {
      amount: details.amount || options.expenseData?.amount || options.settlementData?.amount || null,
      currency: groupInfo?.currency || options.expenseData?.currency || options.settlementData?.currency || null,
      share: details.share || options.expenseData?.share || null,
      description: details.description || options.expenseData?.description || null,
      image: details.image || options.expenseData?.image || null
    };

    // Create notification in database with rich data
    const notification = new Notification({
      userId,
      title: options.title || getNotificationTitle(type),
      message,
      type,
      groupId: groupId || null,
      actor: {
        email: actor.email || null,
        name: actor.name || null,
        profilePicture: actor.profilePicture || null
      },
      groupInfo: groupInfo || null,
      action: {
        type: actionType,
        targetId: targetId
      },
      content: content,
      details: details
    });
    
    await notification.save();

    // Get user for FCM token and preferences for notification settings
    const user = await User.findOne({ email: userId });
    const preferences = await UserPreferences.getOrCreate(userId);
    
    if (user) {
      // Feature flag: Check if push notifications are enabled globally
      const pushNotificationsEnabled = process.env.ENABLE_PUSH_NOTIFICATIONS === 'true';
      
      // Send push notification if:
      // 1. Feature flag is enabled globally
      // 2. User has push notifications enabled in preferences
      // 3. User has FCM token
      if (pushNotificationsEnabled && preferences.notifications.push !== false && user.fcmToken) {
        try {
          await sendPushNotification(
            user.fcmToken,
            options.title || getNotificationTitle(type),
            message,
            {
              notificationId: notification._id.toString(),
              type,
              groupId: groupId ? groupId.toString() : '',
              ...details
            }
          );
        } catch (error) {
          // If token is invalid, remove it
          if (error.message === 'INVALID_TOKEN') {
            user.fcmToken = null;
            await user.save();
          }
          console.error('Push notification error:', error);
        }
      } else if (!pushNotificationsEnabled) {
        console.log('Push notifications are disabled via feature flag');
      }

      // Feature flag: Check if email notifications are enabled globally
      const emailNotificationsEnabled = process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true';
      
      // Send email notification if:
      // 1. Feature flag is enabled globally
      // 2. User has email notifications enabled in preferences
      if (emailNotificationsEnabled && preferences.notifications.email !== false) {
        try {
          if (type === 'expense_added' && options.expenseData) {
            const { userName, groupName, amount, currency, share, description, isInSplit } = options.expenseData;
            await sendExpenseNotificationEmail(
              userId,
              userName,
              groupName,
              amount,
              currency,
              share || 0,
              description,
              isInSplit || false
            );
          } else if ((type === 'settlement_received' || type === 'settlement_recorded') && options.settlementData) {
            const { payerName, groupName, amount, currency } = options.settlementData;
            await sendSettlementNotificationEmail(
              userId,
              payerName,
              groupName,
              amount,
              currency,
              type === 'settlement_received' ? 'received' : 'recorded'
            );
          } else {
            // Generic email notification
            const subject = getNotificationTitle(type);
            const html = `
              <!DOCTYPE html>
              <html>
              <head>
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .content { background-color: #f9f9f9; padding: 20px; border-radius: 5px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="content">
                    <p>${message}</p>
                    <p>Please check the Evenly app for more details.</p>
                  </div>
                </div>
              </body>
              </html>
            `;
            await sendEmail(userId, subject, html);
          }
        } catch (error) {
          console.error('Email notification error:', error);
        }
      } else if (!emailNotificationsEnabled) {
        console.log('Email notifications are disabled via feature flag');
      }
    }

    return notification;
  } catch (error) {
    console.error('Create notification error:', error);
    throw error;
  }
};

/**
 * Get notification title based on type
 * @param {String} type - Notification type
 * @returns {String} - Notification title
 */
const getNotificationTitle = (type) => {
  const titles = {
    'expense_added': 'New Expense Added',
    'settlement_received': 'Settlement Received',
    'settlement_recorded': 'Settlement Recorded'
  };
  return titles[type] || 'New Notification';
};

module.exports = { createNotification }; 