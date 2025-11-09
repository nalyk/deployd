<!--{
  title: 'Using Deployd as a Node.js Module',
  tags: ['node', 'module', 'server']
}-->

## Using Deployd as a Node.js Module

Deployd is a node module and can be used inside other node programs or as the basis of an entire node program.

### Installing

For an app in your current directory:

    npm install deployd

You can also install globally:

    npm install deployd -g

### Hello World

Here is a simple *hello world* using Deployd as a node module.

    // hello.js
    var deployd = require('deployd')
      , options = {port: 3000};

    var dpd = deployd(options);

    dpd.listen();

Run this like any other node program.

    node hello.js

### Server Options <!-- ref -->

- **port** {Number} - the port to listen on
- **db** {Object} - the database to connect to
 - **db.connectionString** {String} - **Recommended**: The URI of the mongoDB using [standard Connection String](http://docs.mongodb.org/manual/reference/connection-string/). Supports MongoDB Atlas, Azure Cosmos DB, AWS DocumentDB. Example: `mongodb+srv://user:pass@cluster.mongodb.net/mydb`
 - **db.connectionOptions** {Object} - **Recommended**: MongoDB driver options (see MongoDB 6+ driver documentation)
   - **tls** {Boolean} - Enable TLS (required for managed MongoDB services)
   - **serverSelectionTimeoutMS** {Number} - Connection timeout (default: 30000)
   - **connectTimeoutMS** {Number} - Initial connection timeout
   - **socketTimeoutMS** {Number} - Socket timeout
   - **minPoolSize** {Number} - Minimum connection pool size (default: 10 production, 1 development)
   - **maxPoolSize** {Number} - Maximum connection pool size (default: 100 production, 10 development)
 - **db.port** {Number} - *Deprecated*: the port of the database server (use connectionString instead)
 - **db.host** {String} - *Deprecated*: the ip or domain of the database server (use connectionString instead)
 - **db.name** {String} - *Deprecated*: the name of the database (use connectionString instead)
 - **db.credentials** {Object} - *Deprecated*: credentials for db (use connectionString instead)
  - **db.credentials.username** {String}
  - **db.credentials.password** {String}
- **env** {String} - the environment to run in.
- **socketIo** {Object} - Socket.IO v4 configuration options
 - **socketIo.options.cors** {Object} - CORS configuration for Socket.IO
 - **socketIo.options.transports** {Array} - Transport methods (default: ['websocket', 'polling'])

*Note: If options.env is "development", the dashboard will not require authentication and configuration will not be cached. Make sure to change this to "production" or something similar when deploying.*

**Modernization**: This fork uses MongoDB driver 6.10.0 and Socket.IO v4.8.1. The old `db.host/port/name` pattern is deprecated in favor of `db.connectionString` + `db.connectionOptions` for MongoDB 6+ compatibility and TLS support.

### Caveats

- Deployd mounts its server on `process.server`. This means you can only run one Deployd server in a process.
- Deployd loads resources from the `process.cwd`. Add this to ensure you are in the right directory: `process.chdir(__dirname)`.
- In order to access the `/dashboard` without a key you must run Deployd with the `env` option set to `development`.
