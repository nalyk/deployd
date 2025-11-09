<!--{
  title: 'Building a custom run script in Node.js',
  tags: ['node', 'module', 'server', 'deployment']
}-->

## Building a custom run script in Node.js

When running in non-local environments we recommend using a simple node script to start your deployd server. With each environment using its own script, you can easily separate out environmental variables (such as connection information) and actions (such as clearing out a test database).

### Example - Production

    // production.js
    var deployd = require('deployd');

    var server = deployd({
      port: process.env.PORT || 5000,
      env: 'production',
      db: {
        // Modern MongoDB connection string (supports MongoDB Atlas, Azure Cosmos DB, etc.)
        connectionString: process.env.MONGODB_URI || 'mongodb://localhost:27017/my-db',
        connectionOptions: {
          serverSelectionTimeoutMS: 30000,
          connectTimeoutMS: 30000,
          socketTimeoutMS: 30000,
          tls: true,  // Required for managed MongoDB services
          tlsAllowInvalidCertificates: true,
          tlsAllowInvalidHostnames: true,
          minPoolSize: 10,
          maxPoolSize: 100
        }
      }
    });

    server.listen();

    server.on('listening', function() {
      console.log("Server is listening");
      console.log("Health checks available at /__health/live and /__health/ready");
      console.log("Metrics available at /metrics");
    });

    server.on('error', function(err) {
      console.error(err);
      process.nextTick(function() { // Give the server a chance to return an error
        process.exit();
      });
    });

    // Graceful shutdown on SIGTERM (Kubernetes, Docker)
    process.on('SIGTERM', function() {
      console.log('SIGTERM received - shutting down gracefully...');
      server.close(function() {
        console.log('Server closed');
        process.exit(0);
      });
    });

### Example - Staging

    // staging.js
    var deployd = require('deployd');

    var server = deployd({
      port: process.env.PORT || 5000,
      env: 'staging',
      db: {
        connectionString: process.env.MONGODB_URI || 'mongodb://localhost:27017/my-db-staging',
        connectionOptions: {
          serverSelectionTimeoutMS: 30000,
          connectTimeoutMS: 30000,
          socketTimeoutMS: 30000,
          tls: true,
          tlsAllowInvalidCertificates: true,
          tlsAllowInvalidHostnames: true,
          minPoolSize: 5,
          maxPoolSize: 50
        }
      }
    });

    // remove all data in the 'todos' collection
    var todos = server.createStore('todos');

    todos.remove(function() {
      // all todos removed
      server.listen();
    });

    server.on('error', function(err) {
      console.error(err);
      process.nextTick(function() { // Give the server a chance to return an error
        process.exit();
      });
    });
    
### Running Your App in Production

To run your app as a daemon, use the `forever` module. You can install it from npm.

    npm install forever -g
    
Then start the appropriate run script based on your environment.

    forever start production.js
    
This will daemonize your app and make sure it runs even if it crashes.