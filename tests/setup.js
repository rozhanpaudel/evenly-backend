const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

let mongod;

// Connect to the in-memory database before all tests
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
});

// Clear all data between tests
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany();
  }
});

// Disconnect and stop mongod after all tests
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

// Helper function to generate test JWT tokens
global.generateTestToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'test-secret');
}; 