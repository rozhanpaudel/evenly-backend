const cluster = require('cluster');
const os = require('os');
const process = require('process');

const WORKERS = process.env.WEB_CONCURRENCY || os.cpus().length;

if (cluster.isPrimary) {
  console.log(`Primary process ${process.pid} is running`);
  console.log(`Starting ${WORKERS} workers...`);

  // Fork workers
  for (let i = 0; i < WORKERS; i++) {
    cluster.fork();
  }

  // Listen for dying workers
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died (${signal || code}). Restarting...`);
    cluster.fork();
  });

  // Log when a worker comes online
  cluster.on('online', (worker) => {
    console.log(`Worker ${worker.process.pid} is online`);
  });

  // Handle uncaught exceptions in master
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception in master:', err);
  });

} else {
  require('./index'); // Start your app
} 