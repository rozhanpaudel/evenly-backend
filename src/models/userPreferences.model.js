const mongoose = require('mongoose');

const userPreferencesSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // Notification preferences
  notifications: {
    email: {
      type: Boolean,
      default: true
    },
    push: {
      type: Boolean,
      default: true
    }
  },
  // UI preferences
  theme: {
    type: String,
    enum: ['light', 'dark', 'system'],
    default: 'system'
  },
  // Currency preferences
  currency: {
    default: {
      type: String,
      default: 'USD'
    },
    displayFormat: {
      type: String,
      enum: ['symbol', 'code', 'name'],
      default: 'symbol'
    }
  },
  // Language preferences
  language: {
    type: String,
    default: 'en',
    enum: ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'hi']
  },
  // Date and time preferences
  dateFormat: {
    type: String,
    enum: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'],
    default: 'MM/DD/YYYY'
  },
  timeFormat: {
    type: String,
    enum: ['12h', '24h'],
    default: '12h'
  },
  // Privacy preferences
  privacy: {
    showEmail: {
      type: Boolean,
      default: false
    },
    showProfilePicture: {
      type: Boolean,
      default: true
    }
  },
  // App preferences
  app: {
    autoBackup: {
      type: Boolean,
      default: true
    },
    biometricAuth: {
      type: Boolean,
      default: false
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update updatedAt before saving
userPreferencesSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to get or create preferences
userPreferencesSchema.statics.getOrCreate = async function(email) {
  let preferences = await this.findOne({ email });
  if (!preferences) {
    preferences = new this({ email });
    await preferences.save();
  }
  return preferences;
};

module.exports = mongoose.model('UserPreferences', userPreferencesSchema);

