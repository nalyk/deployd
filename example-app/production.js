// production.js - Production environment configuration
// Based on: docs/deployd_docs/server/run-script.md

// Load environment variables
require('dotenv').config();

var deployd = require('../index');

var server = deployd({
  port: process.env.PORT || 5000,
  env: 'production',
  db: {
    connectionString: process.env.MONGODB_URI,
    connectionOptions: {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000,
      tls: true,
      minPoolSize: 10,
      maxPoolSize: 100
    }
  }
});

server.listen();

server.on('listening', function() {
  console.log('Production server is listening on port ' + (process.env.PORT || 5000));
});

server.on('error', function(err) {
  console.error('Production server error:', err);
  process.nextTick(function() {
    process.exit(1);
  });
});

// Graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

function shutdown() {
  console.log('Shutting down gracefully...');
  server.close(function() {
    if (server.db) {
      server.db.close(function() {
        console.log('Shutdown complete');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
}
