<!--{
  title: 'Using Deployd as an Express middleware',
  tags: ['express', 'connect', 'middleware', 'server']
}-->

## Using Deployd as an Express middleware

Deployd can be used with express/connect. Deployd will attach functions and handler to express server object.

### Installing

For an app in your current directory:

    npm install deployd express socket.io

### Hello World

Here is a simple *hello world* using Deployd as an express middleware with Socket.IO v4.

    // hello-server-attach.js
    var PORT = process.env.PORT || 3000;
    var ENV = process.env.NODE_ENV || 'production';

    // setup http + express
    var express = require('express');
    var app = express();
    var server = require('http').createServer(app);

    // Socket.IO v4 with CORS configuration
    var io = require('socket.io')(server, {
        cors: {
          origin: "*",  // Configure appropriately for production
          methods: ["GET", "POST"]
        },
        transports: ['websocket', 'polling']
    });

    // setup deployd with modern MongoDB configuration
    require('deployd').attach(server, {
        socketIo: io,  // if not provided, attach will create one for you
        env: ENV,
        db: {
          connectionString: process.env.MONGODB_URI || 'mongodb://localhost:27017/test-app',
          connectionOptions: {
            serverSelectionTimeoutMS: 30000,
            connectTimeoutMS: 30000,
            socketTimeoutMS: 30000,
            tls: true,  // Required for managed MongoDB
            minPoolSize: ENV === 'production' ? 10 : 1,
            maxPoolSize: ENV === 'production' ? 100 : 10
          }
        }
    });

    // After attach, express can use server.handleRequest as middleware
    app.use(server.handleRequest);

    // start server
    server.listen(PORT, function() {
      console.log('Server listening on port', PORT);
      console.log('Environment:', ENV);
    });


Run this like any other express server.

    node hello-server-attach.js

### Server Options <!-- ref -->

- **db** {Object} - the database to connect to
 - **db.connectionString** {String} - **Recommended**: The URI of the mongoDB using [standard Connection String](http://docs.mongodb.org/manual/reference/connection-string/). Supports MongoDB Atlas and other managed services. Example: `mongodb+srv://user:pass@cluster.mongodb.net/mydb`
 - **db.connectionOptions** {Object} - **Recommended**: MongoDB driver 6+ options
   - **tls** {Boolean} - Enable TLS (required for managed MongoDB services)
   - **serverSelectionTimeoutMS** {Number} - Connection timeout (default: 30000)
   - **minPoolSize** {Number} - Minimum connection pool size
   - **maxPoolSize** {Number} - Maximum connection pool size
 - **db.port** {Number} - *Deprecated*: use connectionString instead
 - **db.host** {String} - *Deprecated*: use connectionString instead
 - **db.name** {String} - *Deprecated*: use connectionString instead
 - **db.credentials** {Object} - *Deprecated*: use connectionString instead
  - **db.credentials.username** {String}
  - **db.credentials.password** {String}
- **env** {String} - the environment to run in.
- **socketIo** {Object} - Socket.IO v4 instance. If not provided, Deployd will create one with default CORS configuration.

*Note: If options.env is "development", the dashboard will not require authentication and configuration will not be cached. Make sure to change this to "production" or something similar when deploying.*

**Socket.IO v4**: This fork uses Socket.IO v4.8.1. Key changes from v1:
- CORS must be explicitly configured (see example above)
- `socket.rooms` is now a Set (use `Array.from(socket.rooms)`)
- Improved performance and modern WebSocket support
- See lib/server.js:69-78 for default configuration

### Caveats

- Deployd mounts its server on `process.server`. This means you can only run one Deployd server in a process.
- Deployd loads resources from the `process.cwd`. Add this to ensure you are in the right directory: `process.chdir(__dirname)`.
- In order to access the `/dashboard` without a key you must run Deployd with the `env` option set to `development`.
