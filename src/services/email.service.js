const nodemailer = require('nodemailer');

// Create reusable transporter
let transporter = null;

const initializeEmailService = () => {
  if (transporter) {
    return transporter;
  }

  // SMTP configuration
  const smtpConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  };

  // Only create transporter if credentials are provided
  if (smtpConfig.auth.user && smtpConfig.auth.pass) {
    transporter = nodemailer.createTransport(smtpConfig);
    
    // Verify connection
    transporter.verify((error, success) => {
      if (error) {
        console.error('Email service initialization error:', error);
      } else {
        console.log('Email service is ready to send messages');
      }
    });
  } else {
    console.warn('SMTP credentials not configured. Email notifications will not work.');
  }

  return transporter;
};

// Initialize on module load
initializeEmailService();

/**
 * Send email notification
 * @param {String} to - Recipient email address
 * @param {String} subject - Email subject
 * @param {String} html - HTML email content
 * @param {String} text - Plain text email content (optional)
 * @returns {Promise<Object>} - Nodemailer response
 */
const sendEmail = async (to, subject, html, text = null) => {
  // Feature flag check
  if (process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'true') {
    console.log('Email notifications are disabled via feature flag (ENABLE_EMAIL_NOTIFICATIONS)');
    return null;
  }

  if (!transporter) {
    console.warn('Email service not initialized. Skipping email notification.');
    return null;
  }

  if (!to) {
    console.warn('No recipient email provided. Skipping email notification.');
    return null;
  }

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@evenly.app',
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, '') // Strip HTML tags for plain text
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

/**
 * Send expense notification email
 * @param {String} to - Recipient email
 * @param {String} userName - Name of user who added expense
 * @param {String} groupName - Group name
 * @param {Number} amount - Expense amount
 * @param {String} currency - Currency code
 * @param {Number} share - User's share (if applicable)
 * @param {String} description - Expense description
 * @param {Boolean} isInSplit - Whether user is in the split
 * @returns {Promise<Object>} - Email send result
 */
const sendExpenseNotificationEmail = async (to, userName, groupName, amount, currency, share, description, isInSplit) => {
  const subject = `New expense added in ${groupName}`;
  
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
        .expense-details { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #4CAF50; }
        .amount { font-size: 24px; font-weight: bold; color: #4CAF50; }
        .share { background-color: #fff3cd; padding: 10px; border-radius: 5px; margin-top: 10px; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>New Expense Added</h2>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p><strong>${userName}</strong> added a new expense in the group <strong>${groupName}</strong>.</p>
          
          <div class="expense-details">
            <p><strong>Description:</strong> ${description}</p>
            <p class="amount">${currency} ${amount.toFixed(2)}</p>
  `;

  if (isInSplit && share > 0) {
    html += `
            <div class="share">
              <p><strong>Your share:</strong> ${currency} ${share.toFixed(2)}</p>
            </div>
    `;
  }

  html += `
          </div>
          
          <p>Please check the Evenly app for more details.</p>
        </div>
        <div class="footer">
          <p>This is an automated notification from Evenly.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(to, subject, html);
};

/**
 * Send settlement notification email
 * @param {String} to - Recipient email
 * @param {String} payerName - Name of user who paid
 * @param {String} groupName - Group name
 * @param {Number} amount - Settlement amount
 * @param {String} currency - Currency code
 * @param {String} type - Type of notification (received or recorded)
 * @returns {Promise<Object>} - Email send result
 */
const sendSettlementNotificationEmail = async (to, payerName, groupName, amount, currency, type) => {
  const subject = type === 'received' 
    ? `Settlement received in ${groupName}`
    : `Settlement recorded in ${groupName}`;
  
  const message = type === 'received'
    ? `<strong>${payerName}</strong> marked a settlement payment of <strong>${currency} ${amount.toFixed(2)}</strong> to you.`
    : `<strong>${payerName}</strong> settled <strong>${currency} ${amount.toFixed(2)}</strong> in the group.`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
        .amount { font-size: 24px; font-weight: bold; color: #2196F3; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Settlement Notification</h2>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p>${message}</p>
          <p><strong>Group:</strong> ${groupName}</p>
          <p class="amount">${currency} ${amount.toFixed(2)}</p>
          <p>Please check the Evenly app for more details.</p>
        </div>
        <div class="footer">
          <p>This is an automated notification from Evenly.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(to, subject, html);
};

module.exports = {
  sendEmail,
  sendExpenseNotificationEmail,
  sendSettlementNotificationEmail
};

