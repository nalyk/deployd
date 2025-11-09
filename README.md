# deployd

> A simple API framework for building realtime applications with MongoDB.

## Fork Notice

This is a modernized fork of [deployd/deployd](https://github.com/deployd/deployd), which was discontinued in 2019. The original project only supported MongoDB 4 and Node.js versions up to 14. This fork has been extensively modernized to support current technology stacks and is actively maintained.

**Original Repository**: https://github.com/deployd/deployd (discontinued 2019)
**Current Repository**: https://github.com/nalyk/deployd

## Modernization Summary

This fork includes comprehensive updates to bring deployd to 2025 standards:

- **Node.js 22 LTS** with TLS 1.0+ compatibility for managed MongoDB services
- **MongoDB 6+** support with modern driver patterns (MongoClient, new CRUD operations)
- **Socket.IO v4.8.1** upgrade from v1.7.4 (8 years of updates)
- **Zero deprecation warnings** - all dependencies updated to latest stable versions
- **Native integrations** - dpd-clientlib, dpd-dashboard, and dpd-count integrated directly
- **Production-ready** - connection pooling, graceful error handling, optimized timeouts
- **Modern architecture** - clean separation between library code and application code

## Requirements

- **Node.js**: 22.x LTS or newer
- **MongoDB**: 6.0 or newer (supports both local and managed cloud instances)
- **Network**: For managed MongoDB services with TLS 1.0/1.1, this fork includes compatibility fixes

## Features

### Core Features
- REST/HTTP API exposure with automatic routing
- Realtime WebSocket notifications via Socket.IO
- User authentication and session management
- Event-driven architecture with sandboxed JavaScript execution
- Dashboard UI for resource configuration
- Browser JavaScript client library
- Extensible via npm modules

### Production Features
- **Health Check Endpoints** - Kubernetes-ready liveness, readiness, and startup probes
- **Prometheus Metrics** - Full observability with HTTP, database, and Node.js metrics
- **Structured Logging** - JSON logging with request ID correlation (Winston)
- **Rate Limiting** - DoS protection with configurable thresholds
- **Circuit Breaker** - Automatic MongoDB failure protection
- **Request Tracing** - UUID-based request IDs for distributed systems
- **Graceful Shutdown** - SIGTERM/SIGINT handlers for zero-downtime deployments
- **Script Timeouts** - Configurable timeout enforcement for event scripts
- **Security Hardening** - Query operator whitelist, request size limits

## Installation

Install the deployd CLI globally:

```bash
npm install deployd-cli -g
```

Verify installation:

```bash
dpd -V
```

## Quick Start

### Create a New Application

```bash
dpd create myapp
cd myapp
dpd -d
```

This starts a development server with the dashboard available at `http://localhost:2403/dashboard`.

### Using the Example Application

This repository includes a complete example application:

```bash
# Development mode
npm start

# Production mode
npm run start:prod
```

The example app demonstrates:
- Collection resources (articles, users)
- User authentication
- Event scripts
- Dashboard configuration

### Creating Your Own Application

Copy the example application as a template:

```bash
cp -r example-app/ myapp/
cd myapp/
cp .env.example .env
```

Edit `.env` with your MongoDB connection string:

```bash
MONGODB_URI=mongodb://localhost:27017/myapp
# or for managed services:
# MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/myapp?tls=true
```

Start the server:

```bash
node development.js
```

Visit `http://localhost:2403/dashboard` to configure resources.

## Project Structure

```
deployd/
├── lib/                    # Core framework code
│   ├── resources/          # Built-in resource types
│   │   ├── collection/     # Collection resource
│   │   ├── user-collection.js
│   │   ├── files.js
│   │   └── dpd-count.js
│   ├── clib/              # Client library
│   ├── dashboard/         # Dashboard UI
│   ├── db.js              # MongoDB abstraction layer
│   ├── server.js          # HTTP + Socket.IO server
│   └── ...
├── example-app/           # Example application
│   ├── resources/         # API resources
│   ├── development.js     # Dev server entry point
│   ├── production.js      # Production server
│   └── .env.example       # Configuration template
├── test/                  # Test suite
└── index.js               # Library entry point
```

## Usage Patterns

### Programmatic Server

Instead of using the `dpd` CLI, create a Node.js script for production use:

```javascript
const deployd = require('deployd');

const server = deployd({
  port: process.env.PORT || 3000,
  env: 'production',
  db: {
    connectionString: process.env.MONGODB_URI || 'mongodb://localhost/mydb',
    connectionOptions: {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000,
      tls: true,
      minPoolSize: 1,
      maxPoolSize: 10
    }
  }
});

server.listen();

server.on('listening', () => {
  console.log(`Server running on port ${server.options.port}`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});
```

### Attach to Existing Express App

```javascript
const express = require('express');
const deployd = require('deployd');

const app = express();

deployd.attach(app, {
  socketIo: { /* socket.io options */ },
  db: { connectionString: process.env.MONGODB_URI }
});

app.listen(3000);
```

## Testing

### Run All Tests

```bash
npm test
```

### Run End-to-End Tests

```bash
npm run test:e2e
```

### Remote MongoDB Testing

Set the `MONGODB_URI` environment variable to test against a remote database:

```bash
MONGODB_URI=mongodb+srv://user:pass@cluster/db npm test
```

## Configuration

### Database Options

Configure MongoDB connection in your server script:

```javascript
db: {
  connectionString: 'mongodb+srv://user:pass@cluster/dbname',
  connectionOptions: {
    tls: true,
    tlsAllowInvalidCertificates: true,  // For managed services with custom certs
    tlsAllowInvalidHostnames: true,
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 30000,
    minPoolSize: 10,      // Production: 10 (development: 1)
    maxPoolSize: 100      // Production: 100 (development: 10)
  }
}
```

### Production Configuration

Full production configuration with all features enabled:

```javascript
const deployd = require('deployd');

const server = deployd({
  port: process.env.PORT || 3000,
  env: 'production',

  // Database with production pool sizes
  db: {
    connectionString: process.env.MONGODB_URI,
    connectionOptions: {
      minPoolSize: 10,
      maxPoolSize: 100,
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000
    }
  },

  // Request body size limit (default: 1MB)
  maxBodySize: 5 * 1024 * 1024,  // 5MB

  // Event script timeout (default: 10000ms)
  scriptTimeout: 5000,  // 5 seconds

  // Rate limiting (disabled by default)
  rateLimit: {
    enabled: true,
    windowMs: 60000,  // 1 minute window
    max: 100          // 100 requests per window
  }
});

server.listen();
```

### Environment Variables

Recommended environment variables for production:

```bash
# Required
MONGODB_URI=mongodb+srv://user:pass@cluster/dbname
NODE_ENV=production
PORT=3000

# Optional
LOG_LEVEL=info              # debug, info, warn, error
MAX_BODY_SIZE=5242880       # 5MB in bytes
SCRIPT_TIMEOUT=5000         # 5 seconds
RATE_LIMIT_WINDOW=60000     # 1 minute
RATE_LIMIT_MAX=100          # requests per window
```

### Socket.IO Options

Configure WebSocket behavior:

```javascript
socketIo: {
  options: {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
  }
}
```

## Production Deployment

### Health Check Endpoints

Deployd provides Kubernetes-compatible health check endpoints:

```yaml
# Kubernetes configuration example
livenessProbe:
  httpGet:
    path: /__health/live
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /__health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10

startupProbe:
  httpGet:
    path: /__health/startup
    port: 3000
  failureThreshold: 30
  periodSeconds: 10
```

**Available endpoints:**
- `GET /__health/live` - Returns 200 if server is running
- `GET /__health/ready` - Returns 200 if database is connected, 503 otherwise
- `GET /__health/startup` - Returns 200 if startup complete, 503 otherwise

### Metrics Endpoint

Prometheus metrics available at:

```bash
# Scrape configuration
curl http://localhost:3000/metrics
```

**Metrics exposed:**
- HTTP request duration and count (by method, route, status)
- Database operation duration and count (by operation, collection)
- Circuit breaker state
- Active database connections
- Active sessions and WebSocket connections
- Node.js default metrics (CPU, memory, event loop lag, GC)

### Logging

Structured JSON logging in production (human-readable in development):

```javascript
// Production log format (JSON)
{
  "timestamp": "2025-11-09 10:15:23",
  "level": "error",
  "message": "Request error",
  "requestId": "a3b4c5d6-e7f8-9012-3456-789abcdef012",
  "method": "POST",
  "url": "/users",
  "service": "deployd",
  "environment": "production"
}
```

**Log files (production only):**
- `error.log` - Error level logs
- `combined.log` - All logs

**Log level control:**
```bash
LOG_LEVEL=info node server.js  # debug, info, warn, error
```

### Docker Deployment

Example Dockerfile:

```dockerfile
FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .

EXPOSE 3000

# Graceful shutdown support
STOPSIGNAL SIGTERM

CMD ["node", "production.js"]
```

Example docker-compose.yml:

```yaml
version: '3.8'
services:
  deployd:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/myapp
      - LOG_LEVEL=info
    depends_on:
      - mongo
    restart: unless-stopped

  mongo:
    image: mongo:6
    volumes:
      - mongo-data:/data/db
    restart: unless-stopped

volumes:
  mongo-data:
```

## Best Practices

1. **Use programmatic servers** - The `dpd` CLI is for prototyping only. Production applications should use a Node.js script.

2. **Implement access control** - Deployd has no built-in access control. Use `BeforeRequest` events to enforce permissions:

   ```javascript
   // On BeforeRequest
   if (!me && (this.method === 'POST' || this.method === 'PUT' || this.method === 'DELETE')) {
     cancel("Authentication required", 401);
   }
   ```

3. **Structure resources hierarchically** - Use namespaced resource names:
   - `users` - user collection
   - `users/photos` - user photos
   - `users/photos/resize` - photo processing event

4. **Avoid nested queries** - Don't run `dpd.collection.get()` inside `On GET` handlers. Use separate event endpoints and merge results in code.

5. **Use connection pooling** - Configure `minPoolSize: 10` and `maxPoolSize: 100` for production deployments.

6. **Handle TLS properly** - For managed MongoDB services (DigitalOcean, Atlas, etc.), ensure TLS settings match your provider's requirements.

7. **Enable rate limiting** - Protect against DoS attacks by enabling rate limiting in production.

8. **Monitor metrics** - Set up Prometheus scraping and Grafana dashboards for production monitoring.

9. **Configure timeouts** - Set appropriate `scriptTimeout` values based on your event script complexity.

10. **Use request IDs** - Request IDs are automatically generated and included in logs for tracing.

## Migration from Original Deployd

### From v1.0.0 or Earlier

This fork maintains API compatibility with the original deployd v1.0.0+. If you're upgrading from the original repository:

1. Update Node.js to version 22 or newer
2. Update MongoDB to version 6 or newer
3. Install dependencies:
   ```bash
   npm install deployd@latest --save
   npm install dpd-dashboard dpd-clientlib --save-dev
   ```
4. Update your server script's database configuration to use modern connection options (see Configuration section)

### Breaking Changes

- MongoDB 6+ required (MongoDB 2.x, 3.x, 4.x no longer supported)
- Node.js 22+ required (older versions not tested)
- Socket.IO v4 client required if using custom WebSocket clients

## Documentation

- [Full Documentation](http://docs.deployd.com/)
- [Getting Started Guide](http://docs.deployd.com/docs/getting-started/what-is-deployd.html)
- [API Documentation](http://docs.deployd.com/api)
- [Example Applications](http://docs.deployd.com/examples/)

## Community

- [Gitter Chat](https://gitter.im/deployd/deployd)
- [Google Group](https://groups.google.com/forum/#!forum/deployd-users)

## Technical Details

### Node.js 22 Compatibility

This fork includes TLS compatibility fixes for Node.js 22, which disabled TLS 1.0/1.1 by default. The fix enables TLS 1.0+ for compatibility with managed MongoDB services that may use older TLS versions.

### Socket.IO v4 Upgrade

Complete upgrade from Socket.IO v1.7.4 (2017) to v4.8.1:
- Modern WebSocket transport with better performance
- CORS configuration for cross-origin WebSocket connections
- Client library updated to match (46KB minified, 23% smaller)
- Rooms API updated (Set-based instead of array-based)

### MongoDB Driver Modernization

Updated to MongoDB driver 6.10.0 with modern patterns:
- MongoClient connection pattern
- Modern CRUD operations (insertOne/Many, updateOne/Many, etc.)
- Proper connection pooling and timeout handling
- Promise-based API with callback compatibility

### Production Hardening

**Performance:**
- Router caching in production (config reload eliminated)
- Connection pooling (10-100 connections, environment-based)
- Async.eachSeries routing (nextTick recursion eliminated)
- HTTP Keep-Alive (65s timeout)

**Reliability:**
- Circuit breaker for MongoDB operations (opossum)
- Graceful shutdown handlers (SIGTERM/SIGINT with 30s timeout)
- Startup vs runtime error distinction
- Script timeout enforcement (configurable, default 10s)
- Router double-call protection

**Security:**
- MongoDB operator whitelist (blocks $where, $function, $expr, $accumulator)
- Request body size limits (configurable, default 1MB)
- Rate limiting (optional, configurable)
- Request ID tracking (UUID-based)

**Observability:**
- Prometheus metrics endpoint (/metrics)
- Structured JSON logging (Winston)
- Health check endpoints (Kubernetes-compatible)
- Request tracing with correlation IDs
- Performance monitoring (slow script detection)

## Development

### Clone and Install

```bash
git clone https://github.com/nalyk/deployd.git
cd deployd
npm install
```

### Run Tests

```bash
# Start MongoDB (if testing locally)
mongod &

# Run test suite
npm test
```

### Run Example Application

```bash
npm start
```

## License

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

Copyright 2017 deployd llc

## Fork Maintenance

This fork is actively maintained by [nalyk](https://github.com/nalyk) with focus on:
- Modern Node.js and MongoDB compatibility
- Security updates for all dependencies
- Performance optimizations
- Production readiness

For issues, feature requests, or contributions, please visit the [GitHub repository](https://github.com/nalyk/deployd).
