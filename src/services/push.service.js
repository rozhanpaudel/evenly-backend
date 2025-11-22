const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    // Try to initialize with service account
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else if (process.env.FIREBASE_PROJECT_ID) {
      // Initialize with individual credentials
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL
        })
      });
    } else {
      console.warn('Firebase Admin not initialized. Push notifications will not work.');
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }
}

/**
 * Send push notification to a single user
 * @param {String} fcmToken - FCM token of the user
 * @param {String} title - Notification title
 * @param {String} body - Notification body
 * @param {Object} data - Additional data payload
 * @returns {Promise<Object>} - FCM response
 */
const sendPushNotification = async (fcmToken, title, body, data = {}) => {
  // Feature flag check
  if (process.env.ENABLE_PUSH_NOTIFICATIONS !== 'true') {
    console.log('Push notifications are disabled via feature flag (ENABLE_PUSH_NOTIFICATIONS)');
    return null;
  }

  if (!admin.apps.length) {
    console.warn('Firebase Admin not initialized. Skipping push notification.');
    return null;
  }

  if (!fcmToken) {
    console.warn('No FCM token provided. Skipping push notification.');
    return null;
  }

  // Convert data values to strings (required for FCM data payload)
  const dataPayload = {};
  Object.keys(data).forEach(key => {
    dataPayload[key] = String(data[key]);
  });

  const message = {
    notification: {
      title,
      body
    },
    data: dataPayload, // Data payload for both Android and iOS
    token: fcmToken,
    // Android-specific configuration
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'evenly_notifications', // Android notification channel
        priority: 'high',
        defaultSound: true,
        defaultVibrateTimings: true
      }
    },
    // iOS-specific configuration (APNS)
    apns: {
      headers: {
        'apns-priority': '10', // High priority for immediate delivery
        'apns-push-type': 'alert'
      },
      payload: {
        aps: {
          alert: {
            title,
            body
          },
          sound: 'default',
          badge: 1,
          'content-available': 1 // Enable background notifications
        }
      }
    }
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('Push notification sent successfully:', response);
    return response;
  } catch (error) {
    console.error('Error sending push notification:', error);
    
    // Handle invalid token errors
    if (error.code === 'messaging/invalid-registration-token' || 
        error.code === 'messaging/registration-token-not-registered') {
      console.warn('Invalid FCM token, should be removed from database');
      throw new Error('INVALID_TOKEN');
    }
    
    throw error;
  }
};

/**
 * Send push notification to multiple users
 * @param {Array<String>} fcmTokens - Array of FCM tokens
 * @param {String} title - Notification title
 * @param {String} body - Notification body
 * @param {Object} data - Additional data payload
 * @returns {Promise<Object>} - FCM batch response
 */
const sendPushNotificationToMultiple = async (fcmTokens, title, body, data = {}) => {
  // Feature flag check
  if (process.env.ENABLE_PUSH_NOTIFICATIONS !== 'true') {
    console.log('Push notifications are disabled via feature flag (ENABLE_PUSH_NOTIFICATIONS)');
    return null;
  }

  if (!admin.apps.length) {
    console.warn('Firebase Admin not initialized. Skipping push notifications.');
    return null;
  }

  if (!fcmTokens || fcmTokens.length === 0) {
    return null;
  }

  // Filter out null/undefined tokens
  const validTokens = fcmTokens.filter(token => token);

  if (validTokens.length === 0) {
    return null;
  }

  // Convert data values to strings (required for FCM data payload)
  const dataPayload = {};
  Object.keys(data).forEach(key => {
    dataPayload[key] = String(data[key]);
  });

  const messages = validTokens.map(token => ({
    notification: {
      title,
      body
    },
    data: dataPayload, // Data payload for both Android and iOS
    token,
    // Android-specific configuration
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'evenly_notifications', // Android notification channel
        priority: 'high',
        defaultSound: true,
        defaultVibrateTimings: true
      }
    },
    // iOS-specific configuration (APNS)
    apns: {
      headers: {
        'apns-priority': '10', // High priority for immediate delivery
        'apns-push-type': 'alert'
      },
      payload: {
        aps: {
          alert: {
            title,
            body
          },
          sound: 'default',
          badge: 1,
          'content-available': 1 // Enable background notifications
        }
      }
    }
  }));

  try {
    const response = await admin.messaging().sendAll(messages);
    console.log(`Push notifications sent: ${response.successCount} successful, ${response.failureCount} failed`);
    
    // Handle invalid tokens
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const error = resp.error;
        if (error.code === 'messaging/invalid-registration-token' || 
            error.code === 'messaging/registration-token-not-registered') {
          console.warn(`Invalid FCM token at index ${idx}, should be removed from database`);
        }
      }
    });
    
    return response;
  } catch (error) {
    console.error('Error sending batch push notifications:', error);
    throw error;
  }
};

module.exports = {
  sendPushNotification,
  sendPushNotificationToMultiple
};

