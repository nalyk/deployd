<!--{
  title: 'Security Hardening',
  tags: ['security', 'production', 'hardening']
}-->

## Security Hardening

Security features and best practices for production Deployd deployments.

### MongoDB Operator Whitelist

Deployd blocks four dangerous MongoDB operators that can execute JavaScript code on the server.

#### Blocked Operators

1. **$where** - Executes JavaScript on MongoDB server
2. **$function** - Executes JavaScript in aggregation pipeline
3. **$accumulator** - Custom aggregation with JavaScript execution
4. **$expr** - Can contain `$function` operator

**All other MongoDB operators are supported** including: `$gt`, `$lt`, `$in`, `$regex`, `$set`, `$inc`, `$push`, etc.

**Implementation**: lib/resources/collection/index.js:143-162

**Error Example**:
```javascript
// This will be blocked
dpd.todos.get({$where: "this.title === 'Admin'"}, function(result) {
  // Error: Operator $where is not allowed for security reasons
});

// Use safe operators instead
dpd.todos.get({title: 'Admin'}, function(result) {
  // Works fine
});
```

### Request Body Size Limits

**Default**: 10MB per request

**Configuration**:
```javascript
var express = require('express');
var app = express();

app.use(express.json({limit: '5mb'}));
app.use(express.urlencoded({limit: '5mb', extended: true}));

require('deployd').attach(server, {/*...*/});
```

### Rate Limiting

Implemented using express-rate-limit middleware.

**Default Configuration**:
- **Development**: No rate limiting
- **Production**: 100 requests per 15 minutes per IP

**Implementation**: lib/server.js:88-100

**Custom Configuration**:
```javascript
var rateLimit = require('express-rate-limit');

var limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // Max requests per window
  message: 'Too many requests',
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);
```

### Script Timeout Enforcement

Event scripts have a maximum execution time to prevent infinite loops.

**Default**: 5 seconds
**Implementation**: lib/script.js:158-172

Scripts that exceed the timeout are automatically terminated.

### TLS/SSL Configuration

#### For Managed MongoDB Services

**Required for**: MongoDB Atlas, Azure Cosmos DB, AWS DocumentDB

```javascript
db: {
  connectionString: process.env.MONGODB_URI,
  connectionOptions: {
    tls: true,                           // Enable TLS
    tlsAllowInvalidCertificates: true,   // For self-signed certs
    tlsAllowInvalidHostnames: true       // For hostname mismatch
  }
}
```

**Production Recommendation**:
```javascript
db: {
  connectionOptions: {
    tls: true,
    // Remove these in strict environments:
    // tlsAllowInvalidCertificates: true,
    // tlsAllowInvalidHostnames: true,
    tlsCAFile: '/path/to/ca-cert.pem'  // Use proper CA cert
  }
}
```

**Implementation**: lib/db.js:14-25 (Node.js 22 TLS compatibility)

#### For HTTPS Server

```javascript
var https = require('https');
var fs = require('fs');

var options = {
  key: fs.readFileSync('/path/to/privkey.pem'),
  cert: fs.readFileSync('/path/to/fullchain.pem')
};

var server = https.createServer(options);

require('deployd').attach(server, {/*...*/});
server.listen(443);
```

### Environment Variable Security

**Never commit secrets to version control!**

#### Use .env Files

```bash
# .env (add to .gitignore!)
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/mydb
SESSION_SECRET=your-secret-key-here
API_KEY=your-api-key
```

```javascript
// Load at startup
require('dotenv').config();

var server = deployd({
  db: {
    connectionString: process.env.MONGODB_URI  // From .env
  }
});
```

#### Use Secret Management

**Kubernetes Secrets**:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: deployd-secrets
type: Opaque
stringData:
  MONGODB_URI: "mongodb+srv://..."
```

**AWS Secrets Manager**:
```javascript
var AWS = require('aws-sdk');
var secretsManager = new AWS.SecretsManager();

secretsManager.getSecretValue({SecretId: 'deployd/mongodb'}, function(err, data) {
  var secret = JSON.parse(data.SecretString);
  var server = deployd({
    db: {connectionString: secret.MONGODB_URI}
  });
  server.listen();
});
```

### Dashboard Security

#### Development Mode

```javascript
// dashboard access without authentication
env: 'development'
```

**Warning**: Only use in local development!

#### Production Mode

```bash
# Generate dashboard key
dpd keygen

# Show generated key
dpd showkey

# Store securely (password manager, secrets vault)
```

Access dashboard at `/dashboard` and enter key.

**Key Storage**: `~/.dpd/keys.json`

### Event Script Security

#### No require() Access

Event scripts run in sandboxed VM context without `require()` access.

```javascript
// This will fail - require() not available
var fs = require('fs');  // Error!

// Use dpd client instead
dpd.users.get(function(users) {
  // This works
});
```

#### Limited Global Scope

Only these globals are available:
- `dpd` - Internal client
- `console` - Logging
- `me` - Current user session
- `query`, `body`, `this` - Request data
- Domain functions: `error()`, `hide()`, `protect()`, `cancel()`

#### No File System Access

Event scripts cannot access the file system directly.

**Workaround**: Use Files resource for file operations.

### CORS Configuration

#### Socket.IO CORS (Required in v4)

```javascript
socketIo: {
  options: {
    cors: {
      origin: "https://yourdomain.com",  // Specific domain
      methods: ["GET", "POST"],
      credentials: true
    }
  }
}
```

**Development** (allow all origins):
```javascript
cors: {
  origin: "*",
  methods: ["GET", "POST"]
}
```

**Production** (restrict to specific domains):
```javascript
cors: {
  origin: ["https://app.yourdomain.com", "https://admin.yourdomain.com"],
  methods: ["GET", "POST"],
  credentials: true
}
```

### Authentication Best Practices

#### Always Validate in Events

```javascript
// On POST /todos
if (!me) {
  cancel('Authentication required', 401);
}

this.createdBy = me.id;
this.createdAt = Date.now();
```

#### Protect Sensitive Operations

```javascript
// On DELETE /todos
if (!me) {
  cancel('Authentication required', 401);
}

if (data.createdBy !== me.id && !me.isAdmin) {
  cancel('Not authorized', 403);
}
```

#### Use BeforeRequest for API Keys

```javascript
// resources/api/beforerequest.js
var apiKey = getHeader('x-api-key');

if (!apiKey) {
  cancel('API key required', 401);
}

// Validate against stored keys
dpd.apikeys.get({key: apiKey, active: true}, function(keys) {
  if (!keys || keys.length === 0) {
    cancel('Invalid API key', 403);
  }
});
```

### Input Validation

#### Type Validation

Use Collection properties schema:
```json
{
  "type": "Collection",
  "properties": {
    "email": {
      "type": "string",
      "required": true,
      "format": "email"
    },
    "age": {
      "type": "number",
      "minimum": 0,
      "maximum": 120
    }
  }
}
```

#### Custom Validation

```javascript
// On Validate
if (this.email && !this.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
  error('email', 'Invalid email format');
}

if (this.password && this.password.length < 8) {
  error('password', 'Password must be at least 8 characters');
}
```

### Security Checklist

Production deployment security checklist:

- [ ] Environment set to `'production'`
- [ ] MongoDB connection uses TLS (`tls: true`)
- [ ] Dashboard requires authentication (`dpd keygen`)
- [ ] CORS configured for specific domains
- [ ] Rate limiting enabled
- [ ] Secrets in environment variables (not code)
- [ ] .env file in .gitignore
- [ ] Event scripts validate authentication
- [ ] Sensitive data protected with `hide()` or `protect()`
- [ ] Input validation in Validate events
- [ ] HTTPS enabled for production server
- [ ] MongoDB connection string uses strong credentials
- [ ] Regular security updates (`npm audit fix`)

### Common Vulnerabilities

#### NoSQL Injection

**Vulnerable**:
```javascript
// User input directly in query
dpd.users.get({username: req.query.username}, callback);
// Attacker: ?username[$ne]=null returns all users!
```

**Protected**:
```javascript
// Validate input type
var username = String(req.query.username);
dpd.users.get({username: username}, callback);

// Or use schema validation
if (typeof this.username !== 'string') {
  error('username', 'Must be string');
}
```

#### XSS in Event Scripts

**Vulnerable**:
```javascript
// Directly setting user input
setResult('<div>' + body.message + '</div>');
```

**Protected**:
```javascript
// Return data, let client sanitize
setResult({message: body.message});

// Or sanitize server-side
var sanitize = function(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};
setResult({message: sanitize(body.message)});
```

### Related Documentation

- [Production Deployment](/docs/server/production-deployment.md)
- [Configuration Reference](/docs/server/configuration-reference.md)
- [User Collection](/docs/collections/user-collection.md)
