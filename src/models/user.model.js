const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId; // Password required only if not OAuth user
    }
  },
  googleId: {
    type: String,
    sparse: true, // Allows multiple null values but enforces uniqueness for non-null values
    unique: true
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
  },
  profilePicture: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving (only for local auth users)
userSchema.pre('save', async function(next) {
  // Skip password hashing for OAuth users or if password is not modified
  if (!this.isModified('password') || this.authProvider === 'google' || !this.password) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password (only for local auth users)
userSchema.methods.comparePassword = async function(candidatePassword) {
  // OAuth users don't have passwords
  if (this.authProvider === 'google' || !this.password) {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema); 