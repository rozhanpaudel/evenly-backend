require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger.config');
const os = require('os');

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());

/**
 * @swagger
 * tags:
 *   name: System
 *   description: System health and monitoring
 */

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Get system health status
 *     tags: [System]
 *     description: Returns the health status of the system including worker information and uptime
 *     responses:
 *       200:
 *         description: System health information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, unhealthy]
 *                   description: Current health status of the system
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   description: Current server timestamp
 *                 pid:
 *                   type: integer
 *                   description: Process ID of the worker handling the request
 *                 uptime:
 *                   type: number
 *                   description: System uptime in seconds
 *                 memory:
 *                   type: object
 *                   properties:
 *                     rss:
 *                       type: number
 *                       description: Resident Set Size memory usage in bytes
 *                     heapTotal:
 *                       type: number
 *                       description: Total size of the allocated heap
 *                     heapUsed:
 *                       type: number
 *                       description: Actual memory used during execution
 *                 system:
 *                   type: object
 *                   properties:
 *                     loadAvg:
 *                       type: array
 *                       items:
 *                         type: number
 *                       description: System load averages for 1, 5, and 15 minutes
 *                     cpuUsage:
 *                       type: object
 *                       properties:
 *                         user:
 *                           type: number
 *                         system:
 *                           type: number
 *                 mongodb:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [connected, disconnected]
 *                     ping:
 *                       type: number
 *                       description: MongoDB connection latency in ms
 *             example:
 *               status: "healthy"
 *               timestamp: "2024-01-10T12:00:00.000Z"
 *               pid: 12345
 *               uptime: 3600
 *               memory:
 *                 rss: 75350016
 *                 heapTotal: 51400704
 *                 heapUsed: 24674584
 *               system:
 *                 loadAvg: [1.05, 1.23, 1.15]
 *                 cpuUsage:
 *                   user: 123456
 *                   system: 78901
 *               mongodb:
 *                 status: "connected"
 *                 ping: 15
 */

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check MongoDB connection
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    let mongoPing = null;
    if (mongoStatus === 'connected') {
      const startTime = Date.now();
      await mongoose.connection.db.admin().ping();
      mongoPing = Date.now() - startTime;
    }

    // Get system metrics
    const memory = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const loadAvg = os.loadavg();

    res.json({
      status: mongoStatus === 'connected' ? 'healthy' : 'unhealthy',
      timestamp: new Date(),
      pid: process.pid,
      uptime: process.uptime(),
      memory: {
        rss: memory.rss,
        heapTotal: memory.heapTotal,
        heapUsed: memory.heapUsed
      },
      system: {
        loadAvg,
        cpuUsage: {
          user: cpuUsage.user,
          system: cpuUsage.system
        }
      },
      mongodb: {
        status: mongoStatus,
        ping: mongoPing
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date(),
      error: error.message
    });
  }
});

// Routes
app.use('/auth', require('./routes/auth.routes'));
app.use('/groups', require('./routes/group.routes'));
app.use('/expenses', require('./routes/expense.routes'));
app.use('/balances', require('./routes/balance.routes'));
app.use('/settlements', require('./routes/settlement.routes'));
app.use('/notifications', require('./routes/notification.routes'));

// Swagger documentation route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Don't send error response if response already sent
  if (res.headersSent) {
    return next(err);
  }
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      status: 'error',
      message: 'Validation error',
      errors: err.errors
    });
  }
  
  if (err.name === 'CastError') {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid ID format'
    });
  }
  
  // Default error response
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Something went wrong!'
  });
});

// Connect to MongoDB with retry logic
const connectWithRetry = async () => {
  const MAX_RETRIES = 5;
  const RETRY_DELAY = 5000; // 5 seconds
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000
      });
      console.log(`Worker ${process.pid} connected to MongoDB`);
      break;
    } catch (err) {
      retries++;
      console.error(`MongoDB connection attempt ${retries} failed:`, err.message);
      if (retries === MAX_RETRIES) {
        console.error('Max retries reached. Exiting...');
        process.exit(1);
      }
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
};

// Start server with graceful shutdown
const startServer = async () => {
  await connectWithRetry();

  const server = app.listen(process.env.PORT || 3000, () => {
    console.log(`Worker ${process.pid} listening on port ${process.env.PORT || 3000}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log(`Worker ${process.pid} is shutting down...`);
    
    server.close(async () => {
      console.log('HTTP server closed');
      
      try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed');
        process.exit(0);
      } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
      }
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  };

  // Handle shutdown signals
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    shutdown();
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown();
  });
};

startServer(); 