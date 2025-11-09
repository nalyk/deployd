// development.js - Development environment configuration
// Loads environment variables from .env file

// Load environment variables
require('dotenv').config();

var deployd = require('../index');

var server = deployd({
  port: process.env.PORT || 2403,
  env: 'development',
  db: {
    connectionString: process.env.MONGODB_URI || 'mongodb://localhost:27017/deployd-example',
    connectionOptions: {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000
    }
  }
});

server.listen();

server.on('listening', function() {
  console.log('');
  console.log('🚀 Deployd MongoDB 6+ Fork - Development Server');
  console.log('================================================');
  console.log('Port:      http://localhost:' + (process.env.PORT || 2403));
  console.log('Dashboard: http://localhost:' + (process.env.PORT || 2403) + '/dashboard');
  console.log('Database:  MongoDB 6+ (DigitalOcean)');
  console.log('');
  console.log('Press Ctrl+C to stop');
  console.log('');
});

server.on('error', function(err) {
  console.error('❌ Server error:', err.message);
  if (err.code === 'EADDRINUSE') {
    console.error('Port ' + (process.env.PORT || 2403) + ' is already in use');
  }
  process.nextTick(function() {
    process.exit(1);
  });
});

// Graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

function shutdown() {
  console.log('\n\n🛑 Shutting down server...');

  // Force exit after 5 seconds if graceful shutdown hangs
  var forceExitTimer = setTimeout(function() {
    console.log('⚠️  Graceful shutdown timed out, forcing exit...');
    process.exit(0);
  }, 5000);

  // Unref the timer so it doesn't keep the process alive
  forceExitTimer.unref();

  server.close(function(err) {
    clearTimeout(forceExitTimer);
    if (err) {
      console.error('❌ Error during shutdown:', err.message);
    }
    console.log('✅ Server stopped gracefully');
    process.exit(0);
  });
}
