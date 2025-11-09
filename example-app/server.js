// server.js - Production-ready deployd server script
// Based on: docs/deployd_docs/server/run-script.md

var deployd = require('../index'); // Use deployd from parent directory

var server = deployd({
  port: process.env.PORT || 2403,
  env: process.env.NODE_ENV || 'development',
  db: {
    // MongoDB 6+ connection using connectionString (recommended)
    connectionString: process.env.MONGODB_URI ||
      'mongodb://localhost:27017/deployd',

    // Optional: MongoDB client options for modern driver
    connectionOptions: {
      // Add any MongoDB client options here
      // e.g., maxPoolSize, minPoolSize, etc.
    }

    // Alternative: individual connection params (legacy style)
    // host: process.env.DB_HOST || 'localhost',
    // port: process.env.DB_PORT || 27017,
    // name: process.env.DB_NAME || 'deployd',
    // credentials: {
    //   username: process.env.DB_USER,
    //   password: process.env.DB_PASS
    // }
  }
});

server.listen();

server.on('listening', function() {
  console.log('Deployd server is listening on port ' + (process.env.PORT || 2403));
  console.log('Environment: ' + (process.env.NODE_ENV || 'development'));
  if (process.env.NODE_ENV === 'development') {
    console.log('Dashboard: http://localhost:' + (process.env.PORT || 2403) + '/dashboard');
  }
});

server.on('error', function(err) {
  console.error('Server error:', err);
  process.nextTick(function() {
    // Give the server a chance to return an error
    process.exit(1);
  });
});

// Graceful shutdown
process.on('SIGTERM', function() {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(function() {
    console.log('HTTP server closed');
    // Close database connection
    if (server.db) {
      server.db.close(function() {
        console.log('Database connection closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
});

process.on('SIGINT', function() {
  console.log('\nSIGINT signal received: closing HTTP server');
  server.close(function() {
    console.log('HTTP server closed');
    // Close database connection
    if (server.db) {
      server.db.close(function() {
        console.log('Database connection closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
});
