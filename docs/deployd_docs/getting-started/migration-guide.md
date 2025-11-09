<!--{
  title: 'Migration Guide',
  tags: ['migration', 'upgrade', 'breaking changes']
}-->

## Migration Guide

This guide helps you migrate from original Deployd (discontinued 2019) to this modernized fork. The fork maintains backward compatibility where possible while introducing breaking changes for Node.js 22 and MongoDB 6+ support.

### Requirements Changes

| Aspect | Original Deployd | This Fork |
|--------|------------------|-----------|
| Node.js | 4.x - 14.x | 22.x LTS+ |
| MongoDB | 2.x - 4.x | 6.0+ |
| Socket.IO | 1.7.4 | 4.8.1 |
| MongoDB Driver | < 4.0 | 6.10.0 |

### Breaking Changes

#### 1. Database Configuration (CRITICAL)

The old `db.host/port/name/credentials` pattern is **deprecated**. Use `connectionString` + `connectionOptions` instead.

**Old Pattern** (still works but deprecated):
```javascript
var server = deployd({
  db: {
    host: 'localhost',
    port: 27017,
    name: 'mydb',
    credentials: {
      username: 'user',
      password: 'pass'
    }
  }
});
```

**New Pattern** (recommended):
```javascript
var server = deployd({
  db: {
    connectionString: 'mongodb://user:pass@localhost:27017/mydb',
    connectionOptions: {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000,
      tls: true,  // Required for managed services
      minPoolSize: 10,
      maxPoolSize: 100
    }
  }
});
```

**MongoDB Atlas Example**:
```javascript
db: {
  connectionString: process.env.MONGODB_URI,  // mongodb+srv://...
  connectionOptions: {
    tls: true,
    serverSelectionTimeoutMS: 30000
  }
}
```

**Migration Steps**:
1. Convert your connection details to a MongoDB connection string
2. Add `connectionOptions` with TLS settings for managed MongoDB
3. Test connection before deploying

**File Reference**: lib/db.js:159-179 (getConnection), lib/db.js:204-215 (connectionOptions)

#### 2. Socket.IO v4 CORS Configuration

Socket.IO v4 requires explicit CORS configuration. The old implicit CORS is **no longer available**.

**Old Pattern** (no explicit CORS):
```javascript
var io = require('socket.io').listen(server, {'log level': 0});
```

**New Pattern** (explicit CORS):
```javascript
var io = require('socket.io')(server, {
  cors: {
    origin: "*",  // Or specific domains
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling']
});
```

**Migration Steps**:
1. Add CORS configuration to all Socket.IO initialization code
2. Update `socket.rooms` references (now a Set, use `Array.from(socket.rooms)`)
3. Test WebSocket connections

**File Reference**: lib/server.js:69-78

#### 3. Native Modules (No Action Required)

These npm modules are now **built-in** and should be **removed from package.json**:

- `dpd-event` → Native Event resource (lib/resources/event.js)
- `dpd-clientlib` → Native (lib/clientlib.js + lib/clib/)
- `dpd-dashboard` → Native (lib/dashboard.js + lib/dashboard/)
- `dpd-count` → Integrated into Collection (lib/resources/collection/index.js:895-962)

**Migration Steps**:
1. Remove these packages from `package.json` dependencies
2. Remove any `npm install dpd-event` instructions from documentation
3. No code changes needed - modules are auto-loaded

#### 4. MongoDB Operator Security

Four dangerous MongoDB operators are now **blocked for security**:

- `$where` - JavaScript execution on server
- `$function` - JavaScript in aggregation
- `$accumulator` - Custom JavaScript aggregation
- `$expr` - Can contain `$function`

All other MongoDB operators are supported.

**If you used these operators**, you must:
1. Rewrite queries to use safe MongoDB operators
2. Move JavaScript logic to event scripts
3. Test thoroughly

**File Reference**: lib/resources/collection/index.js:143-162

### New Features

#### 1. Health Check Endpoints

Available automatically - no configuration needed:

```bash
curl http://localhost:3000/__health/live
curl http://localhost:3000/__health/ready
curl http://localhost:3000/__health/startup
```

Use in Kubernetes/Docker health checks.

**Documentation**: [Production Deployment](/docs/server/production-deployment.md)

#### 2. Prometheus Metrics

Available automatically at `/metrics`:

```bash
curl http://localhost:3000/metrics
```

**Documentation**: [Monitoring & Observability](/docs/server/monitoring-observability.md)

#### 3. Structured Logging

JSON-formatted logs for production:

```javascript
// Automatically enabled when NODE_ENV=production
{
  "timestamp": "2024-11-09T10:30:00.000Z",
  "level": "info",
  "message": "Server listening",
  "requestId": "req-abc123"
}
```

Set log level with `LOG_LEVEL` environment variable.

#### 4. Event Resource (Native)

Create Event resources directly from the dashboard:

```json
// resources/webhook/config.json
{
  "type": "Event"
}
```

Supports: GET, POST, PUT, PATCH, DELETE, beforeRequest

**Documentation**: [Event Resource](/docs/using-modules/official/event.md)

#### 5. Count Endpoint (Native)

All collections automatically have `/count` endpoint:

```javascript
// HTTP
GET /todos/count?completed=true
// Response: {"count": 42}

// dpd.js
dpd.todos.get('count', {completed: true}, function(result) {
  console.log(result.count);
});
```

**Documentation**: [Count Endpoint](/docs/collections/count-endpoint.md)

#### 6. Graceful Shutdown

SIGTERM/SIGINT handling for zero-downtime deployments:

```javascript
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
```

Automatically closes database connections and stops accepting new requests.

**File Reference**: lib/server.js:245-256

### Step-by-Step Migration

#### For Existing Applications

1. **Backup your application and database**
   ```bash
   mongodump --uri="mongodb://localhost:27017/mydb" --out=backup/
   ```

2. **Update Node.js to 22.x LTS**
   ```bash
   nvm install 22
   nvm use 22
   node --version  # Should be 22.x
   ```

3. **Update package.json dependencies**
   ```json
   {
     "dependencies": {
       "deployd": "github:nalyk/deployd",
       "mongodb": "^6.10.0",
       "socket.io": "^4.8.1"
     }
   }
   ```

   Remove:
   ```json
   "dpd-event": "*",
   "dpd-clientlib": "*",
   "dpd-dashboard": "*",
   "dpd-count": "*"
   ```

4. **Install dependencies**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

5. **Update database configuration**

   **Option A**: Environment variable (recommended)
   ```bash
   # .env
   MONGODB_URI=mongodb://localhost:27017/mydb
   NODE_ENV=production
   ```

   ```javascript
   // production.js
   var server = deployd({
     db: {
       connectionString: process.env.MONGODB_URI,
       connectionOptions: {
         serverSelectionTimeoutMS: 30000,
         tls: false  // true for managed services
       }
     }
   });
   ```

   **Option B**: Direct configuration
   ```javascript
   var server = deployd({
     db: {
       connectionString: 'mongodb://localhost:27017/mydb',
       connectionOptions: {
         serverSelectionTimeoutMS: 30000
       }
     }
   });
   ```

6. **Update Socket.IO configuration** (if using attach())

   ```javascript
   // Old
   var io = require('socket.io').listen(server, {'log level': 0});

   // New
   var io = require('socket.io')(server, {
     cors: {
       origin: "*",
       methods: ["GET", "POST"]
     },
     transports: ['websocket', 'polling']
   });
   ```

7. **Test locally**
   ```bash
   node development.js
   # Visit http://localhost:2403/dashboard
   # Test API endpoints
   ```

8. **Test with production MongoDB**
   ```bash
   MONGODB_URI="mongodb+srv://..." node development.js
   ```

9. **Update deployment scripts**

   Add health checks to Docker/Kubernetes manifests (see [Production Deployment](/docs/server/production-deployment.md)).

10. **Deploy to staging environment**
    ```bash
    # Test thoroughly before production
    ```

11. **Deploy to production**
    ```bash
    # Use blue-green or rolling deployment
    ```

#### For New Applications

Start fresh with the modernized fork:

```bash
# Clone example-app structure
git clone https://github.com/nalyk/deployd.git
cd deployd/example-app

# Copy and configure
cp .env.example .env
# Edit .env with your MongoDB URI

# Install and run
npm install
npm start
```

### Testing Checklist

Before deploying to production, verify:

- [ ] Server starts without errors
- [ ] Dashboard loads and authenticates
- [ ] Collections CRUD operations work
- [ ] User authentication works (if using UserCollection)
- [ ] Event scripts execute correctly
- [ ] WebSocket connections work (if using `dpd.on()`)
- [ ] Health checks respond:
  - [ ] `/__health/live` returns 200
  - [ ] `/__health/ready` returns 200 when DB connected
  - [ ] `/__health/startup` returns 200 after startup
- [ ] Metrics endpoint works: `/metrics`
- [ ] Graceful shutdown works (SIGTERM)
- [ ] Production MongoDB connection succeeds
- [ ] TLS connections work (for managed MongoDB)
- [ ] Performance is acceptable under load

### Rollback Plan

If migration fails:

1. **Restore original Deployd**
   ```bash
   npm install deployd@0.8.10  # Or your previous version
   npm install dpd-event dpd-clientlib dpd-dashboard
   ```

2. **Restore old configuration**
   ```javascript
   db: {
     host: 'localhost',
     port: 27017,
     name: 'mydb'
   }
   ```

3. **Downgrade Node.js** (if needed)
   ```bash
   nvm use 14
   ```

4. **Restore from backup**
   ```bash
   mongorestore --uri="mongodb://localhost:27017" backup/
   ```

### Common Issues

#### Issue: "Cannot find type 'Event'"

**Cause**: Using `dpd-event` npm package instead of native Event resource.

**Solution**: Remove `dpd-event` from package.json and reinstall:
```bash
npm uninstall dpd-event
rm -rf node_modules package-lock.json
npm install
```

#### Issue: "EADDRINUSE: address already in use"

**Cause**: Port already bound by another process.

**Solution**:
```bash
# Find process
lsof -i :2403
# Kill process
kill -9 <PID>
# Or use different port
PORT=3000 node development.js
```

#### Issue: "MongoServerSelectionError: connection timeout"

**Cause**: MongoDB not reachable or TLS not configured.

**Solution**:
```javascript
db: {
  connectionString: process.env.MONGODB_URI,
  connectionOptions: {
    serverSelectionTimeoutMS: 60000,  // Increase timeout
    tls: true,  // Enable for managed MongoDB
    tlsAllowInvalidCertificates: true
  }
}
```

#### Issue: "Socket.IO CORS error"

**Cause**: Missing CORS configuration in Socket.IO v4.

**Solution**:
```javascript
socketIo: {
  options: {
    cors: {
      origin: "*",  // Or specific domain
      methods: ["GET", "POST"]
    }
  }
}
```

#### Issue: "Unknown operator: $skipEvents"

**Cause**: This was a bug in earlier versions of this fork, now fixed.

**Solution**: Update to latest version of this fork.

### Getting Help

- **Issues**: https://github.com/nalyk/deployd/issues
- **Original Docs**: http://docs.deployd.com (for reference only)
- **MongoDB Driver Docs**: https://www.mongodb.com/docs/drivers/node/current/

### Version Compatibility Matrix

| This Fork | Node.js | MongoDB | Socket.IO | MongoDB Driver |
|-----------|---------|---------|-----------|----------------|
| 1.2.0+    | 22+     | 6.0+    | 4.8.1     | 6.10.0         |
| 1.1.0     | 22+     | 6.0+    | 4.8.0     | 6.9.0          |
| 1.0.0     | 22+     | 6.0+    | 4.7.0     | 6.8.0          |

| Original  | Node.js | MongoDB | Socket.IO | MongoDB Driver |
|-----------|---------|---------|-----------|----------------|
| 0.8.10    | 4-14    | 2-4     | 1.7.4     | 2.x            |

### Related Documentation

- [Installing Deployd](/docs/getting-started/installing-deployd.md)
- [Production Deployment](/docs/server/production-deployment.md)
- [Configuration Reference](/docs/server/configuration-reference.md)
- [Security Hardening](/docs/server/security-hardening.md)
