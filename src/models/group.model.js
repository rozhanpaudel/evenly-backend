const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  image: String,
  currency: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['personal', 'work', 'travel', 'food', 'entertainment', 'sports', 'others'],
    default: 'others',
    required: true
  },
  members: [{
    type: String,  // email
    ref: 'User'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Group', groupSchema); 