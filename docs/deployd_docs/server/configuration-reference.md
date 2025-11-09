<!--{
  title: 'Configuration Reference',
  tags: ['configuration', 'server', 'options', 'environment']
}-->

## Configuration Reference

Complete reference for all Deployd server configuration options, environment variables, and database settings for this modernized fork.

### Server Options

When creating a Deployd server with `deployd(options)`, the following options are available:

#### port

**Type**: `Number`
**Default**: `2403`
**Environment**: `PORT`

The port for the HTTP server to listen on.

```javascript
var server = deployd({
  port: 3000
});

// Or use environment variable
var server = deployd({
  port: process.env.PORT || 3000
});
```

#### env

**Type**: `String`
**Default**: `'development'`
**Environment**: `NODE_ENV`
**Values**: `'development'`, `'production'`, or custom

The application environment. Affects:
- Dashboard authentication (development = no auth required)
- Router caching (production = routes cached)
- Connection pooling (production = larger pools)
- Logging format (production = JSON)

```javascript
var server = deployd({
  env: process.env.NODE_ENV || 'production'
});
```

**Effects by environment**:

| Feature | development | production |
|---------|-------------|------------|
| Dashboard auth | Not required | Required (keygen) |
| Router cache | Disabled | Enabled |
| Config cache | Disabled | Enabled |
| DB pool size | 1-10 | 10-100 |
| Log format | Pretty | JSON |

#### db

**Type**: `Object`
**Required**: Yes (for database operations)

Database configuration object. See [Database Options](#database-options) below.

#### socketIo

**Type**: `Object`
**Default**: Auto-created with CORS configuration

Socket.IO v4 instance or configuration. If not provided, Deployd creates one with default settings.

**Provide your own instance**:
```javascript
var io = require('socket.io')(server, {
  cors: {
    origin: "https://yourdomain.com",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling']
});

var deployd = require('deployd');
deployd.attach(httpServer, {
  socketIo: io,
  db: { /* ... */ }
});
```

**Let Deployd create one**:
```javascript
var server = deployd({
  socketIo: {
    options: {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      transports: ['websocket', 'polling']
    }
  }
});
```

**File Reference**: lib/server.js:69-78

#### process

**Type**: `Object`
**Advanced use only**

Internal process object configuration. Generally not needed.

### Database Options

The `db` object configures MongoDB connection. **Use `connectionString` + `connectionOptions` for modern MongoDB 6+ deployments.**

#### db.connectionString

**Type**: `String`
**Recommended**: Yes
**Environment**: `MONGODB_URI`

MongoDB connection string in [standard format](https://www.mongodb.com/docs/manual/reference/connection-string/).

**Examples**:

```javascript
// Local MongoDB
db: {
  connectionString: 'mongodb://localhost:27017/mydb'
}

// MongoDB with authentication
db: {
  connectionString: 'mongodb://user:password@localhost:27017/mydb'
}

// MongoDB Atlas
db: {
  connectionString: 'mongodb+srv://user:password@cluster.mongodb.net/mydb'
}

// Multiple hosts (replica set)
db: {
  connectionString: 'mongodb://host1:27017,host2:27017,host3:27017/mydb?replicaSet=rs0'
}

// From environment variable (recommended)
db: {
  connectionString: process.env.MONGODB_URI
}
```

#### db.connectionOptions

**Type**: `Object`
**Recommended**: Yes (for production)

MongoDB driver 6+ connection options. Passed directly to MongoClient constructor.

**Common Options**:

```javascript
db: {
  connectionString: process.env.MONGODB_URI,
  connectionOptions: {
    // TLS/SSL
    tls: true,                           // Enable TLS (required for managed services)
    tlsAllowInvalidCertificates: true,   // Allow self-signed certs (dev only)
    tlsAllowInvalidHostnames: true,      // Allow mismatched hostnames (dev only)

    // Timeouts
    serverSelectionTimeoutMS: 30000,     // How long to wait for server selection
    connectTimeoutMS: 30000,             // Initial connection timeout
    socketTimeoutMS: 30000,              // Socket inactivity timeout

    // Connection Pool
    minPoolSize: 10,                     // Minimum connections to maintain
    maxPoolSize: 100,                    // Maximum connections
    maxIdleTimeMS: 30000,                // How long idle connections live

    // Retry
    retryWrites: true,                   // Retry write operations
    retryReads: true,                    // Retry read operations

    // Compression
    compressors: ['zlib'],               // Enable compression

    // Other
    directConnection: false,             // Connect to specific host only
    appName: 'deployd-app'               // Application name in logs
  }
}
```

**Environment-Specific Defaults**:

```javascript
// Development
{
  minPoolSize: 1,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 30000,
  tls: false
}

// Production
{
  minPoolSize: 10,
  maxPoolSize: 100,
  serverSelectionTimeoutMS: 30000,
  tls: true,
  tlsAllowInvalidCertificates: true,
  tlsAllowInvalidHostnames: true
}
```

**File Reference**: lib/db.js:204-215

#### db.host (Deprecated)

**Type**: `String`
**Deprecated**: Use `connectionString` instead

MongoDB server hostname or IP address.

```javascript
// Old pattern (still works)
db: {
  host: 'localhost',
  port: 27017,
  name: 'mydb'
}

// New pattern (recommended)
db: {
  connectionString: 'mongodb://localhost:27017/mydb'
}
```

#### db.port (Deprecated)

**Type**: `Number`
**Deprecated**: Use `connectionString` instead

MongoDB server port.

#### db.name (Deprecated)

**Type**: `String`
**Deprecated**: Use `connectionString` instead

Database name.

#### db.credentials (Deprecated)

**Type**: `Object`
**Deprecated**: Use `connectionString` instead

Database credentials with `username` and `password` properties.

### Environment Variables

All environment variables that affect Deployd:

#### NODE_ENV

**Default**: `'development'`
**Values**: `'development'`, `'production'`

Sets the application environment. Equivalent to `options.env`.

```bash
NODE_ENV=production node server.js
```

#### PORT

**Default**: `2403`
**Type**: Number

HTTP server port. Equivalent to `options.port`.

```bash
PORT=3000 node server.js
```

#### MONGODB_URI

**Required**: For database operations
**Type**: String

MongoDB connection string. Recommended way to configure database.

```bash
MONGODB_URI="mongodb://localhost:27017/mydb" node server.js
MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/mydb" node server.js
```

#### LOG_LEVEL

**Default**: `'info'`
**Values**: `'error'`, `'warn'`, `'info'`, `'debug'`

Winston logging level. Only affects production mode.

```bash
LOG_LEVEL=debug node server.js
```

#### DEBUG

**Default**: undefined
**Type**: String (comma-separated namespaces)

Debug module namespaces. Works in all environments.

```bash
# All debug output
DEBUG=* node server.js

# Specific modules
DEBUG=db,collection,server node server.js

# Only errors
DEBUG=db:error,session:error node server.js
```

**Available Namespaces**:
- `db` - Database operations
- `db:error` - Database errors
- `collection` - Collection operations
- `server` - Server events
- `router` - Request routing
- `script` - Event script execution
- `session` - Session management
- `session:error` - Session errors
- `event` - Event resource
- `files` - File operations

#### DPD_PORT (Legacy)

**Deprecated**: Use `PORT` instead

#### HOME

Used by dpd CLI for keys location (`~/.dpd/keys.json`).

### Complete Example Configurations

#### Development Configuration

```javascript
// development.js
require('dotenv').config();

var deployd = require('deployd');

var server = deployd({
  port: process.env.PORT || 2403,
  env: 'development',
  db: {
    connectionString: process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp-dev',
    connectionOptions: {
      serverSelectionTimeoutMS: 30000,
      minPoolSize: 1,
      maxPoolSize: 10
    }
  }
});

server.listen();

server.on('listening', function() {
  console.log('Development server running at http://localhost:' + server.options.port);
  console.log('Dashboard: http://localhost:' + server.options.port + '/dashboard');
});

server.on('error', function(err) {
  console.error('Server error:', err);
  process.exit(1);
});
```

#### Production Configuration

```javascript
// production.js
require('dotenv').config();

var deployd = require('deployd');

var server = deployd({
  port: process.env.PORT || 3000,
  env: 'production',
  db: {
    connectionString: process.env.MONGODB_URI,
    connectionOptions: {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000,
      tls: true,
      tlsAllowInvalidCertificates: true,
      tlsAllowInvalidHostnames: true,
      minPoolSize: 10,
      maxPoolSize: 100,
      retryWrites: true,
      retryReads: true,
      compressors: ['zlib'],
      appName: 'my-deployd-app'
    }
  },
  socketIo: {
    options: {
      cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    }
  }
});

server.listen();

server.on('listening', function() {
  console.log('Production server listening on port', server.options.port);
  console.log('Health checks:');
  console.log('  Liveness:  http://localhost:' + server.options.port + '/__health/live');
  console.log('  Readiness: http://localhost:' + server.options.port + '/__health/ready');
  console.log('  Startup:   http://localhost:' + server.options.port + '/__health/startup');
  console.log('Metrics: http://localhost:' + server.options.port + '/metrics');
});

server.on('error', function(err) {
  console.error('Server error:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', function() {
  console.log('SIGTERM received - shutting down gracefully...');
  server.close(function() {
    console.log('Server closed');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(function() {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
});

process.on('SIGINT', function() {
  console.log('SIGINT received');
  server.close(function() {
    process.exit(0);
  });
});
```

#### Docker Configuration

```javascript
// docker.js
var deployd = require('deployd');

var server = deployd({
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'production',
  db: {
    connectionString: process.env.MONGODB_URI,
    connectionOptions: {
      serverSelectionTimeoutMS: 60000,  // Longer for container startup
      tls: process.env.MONGODB_TLS === 'true',
      minPoolSize: parseInt(process.env.DB_MIN_POOL) || 10,
      maxPoolSize: parseInt(process.env.DB_MAX_POOL) || 100
    }
  }
});

server.listen();

// Log to stdout for Docker
server.on('listening', function() {
  console.log(JSON.stringify({
    level: 'info',
    message: 'Server started',
    port: server.options.port,
    timestamp: new Date().toISOString()
  }));
});

server.on('error', function(err) {
  console.error(JSON.stringify({
    level: 'error',
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  }));
  process.exit(1);
});

// Graceful shutdown for Kubernetes
process.on('SIGTERM', function() {
  console.log(JSON.stringify({
    level: 'info',
    message: 'SIGTERM received, shutting down',
    timestamp: new Date().toISOString()
  }));

  server.close(function() {
    process.exit(0);
  });

  setTimeout(function() {
    process.exit(1);
  }, 30000);
});
```

### .env File Example

```bash
# .env file for environment variables

# Server
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Database
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/myapp
MONGODB_TLS=true
DB_MIN_POOL=10
DB_MAX_POOL=100

# Socket.IO
CORS_ORIGIN=https://myapp.com

# Optional
DEBUG=db:error,session:error
```

Load with `require('dotenv').config()` at the top of your server file.

### File System Configuration

Deployd loads resources from the file system:

```
myapp/
├── .dpd/                  # Configuration directory
│   ├── keys.json          # Dashboard access keys
│   └── resources/         # Resource configurations
│       ├── todos/
│       │   ├── config.json
│       │   ├── get.js
│       │   ├── post.js
│       │   └── validate.js
│       └── users/
│           └── config.json
├── .env                   # Environment variables
├── development.js         # Development server
├── production.js          # Production server
└── package.json
```

**File Reference**: lib/config-loader.js

### Performance Tuning

#### Connection Pool Sizing

**Formula**: `maxPoolSize = (number of concurrent requests) × (connections per request)`

```javascript
// Small app (< 100 concurrent users)
minPoolSize: 5,
maxPoolSize: 25

// Medium app (100-1000 concurrent users)
minPoolSize: 10,
maxPoolSize: 50

// Large app (> 1000 concurrent users)
minPoolSize: 20,
maxPoolSize: 200
```

#### Timeout Tuning

```javascript
// Fast local MongoDB
serverSelectionTimeoutMS: 5000,
connectTimeoutMS: 5000,
socketTimeoutMS: 10000

// Managed MongoDB (Atlas, etc.)
serverSelectionTimeoutMS: 30000,
connectTimeoutMS: 30000,
socketTimeoutMS: 30000

// Slow/unreliable network
serverSelectionTimeoutMS: 60000,
connectTimeoutMS: 60000,
socketTimeoutMS: 60000
```

### Related Documentation

- [Production Deployment](/docs/server/production-deployment.md)
- [Migration Guide](/docs/getting-started/migration-guide.md)
- [Security Hardening](/docs/server/security-hardening.md)
- [Building a Custom Run Script](/docs/server/run-script.md)
