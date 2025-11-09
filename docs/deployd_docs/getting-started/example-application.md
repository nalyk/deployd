<!--{
  title: 'Example Application',
  tags: ['example', 'tutorial', 'getting started']
}-->

## Example Application

This fork includes a complete example application in the `example-app/` directory demonstrating all major features.

### Directory Structure

```
example-app/
├── .dpd/                      # Deployd configuration
│   ├── keys.json              # Dashboard API keys (auto-generated)
│   └── resources/             # Resource configurations
│       ├── articles/          # Example Collection
│       │   ├── config.json
│       │   ├── get.js
│       │   ├── post.js
│       │   └── validate.js
│       ├── users/             # Example UserCollection
│       │   ├── config.json
│       │   └── validate.js
│       └── webhook/           # Example Event resource
│           ├── config.json
│           ├── get.js
│           ├── post.js
│           └── beforerequest.js
├── .env.example               # Environment variables template
├── .gitignore                 # Git ignore patterns
├── development.js             # Development server
├── production.js              # Production server
├── server.js                  # Generic server script
├── package.json               # Application dependencies
└── README.md                  # Application documentation
```

### Getting Started

#### 1. Copy Environment Template

```bash
cd example-app
cp .env.example .env
```

#### 2. Configure Environment

Edit `.env`:
```bash
# Server
PORT=2403
NODE_ENV=development

# Database (local)
MONGODB_URI=mongodb://localhost:27017/deployd-example

# Or MongoDB Atlas
# MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/deployd-example
```

#### 3. Install Dependencies

```bash
npm install
```

#### 4. Start Development Server

```bash
npm start
# or
node development.js
```

Server starts at http://localhost:2403

#### 5. Access Dashboard

Visit: http://localhost:2403/dashboard

No authentication required in development mode.

### Example Resources

#### Articles Collection

**Location**: `.dpd/resources/articles/`

A blog articles collection demonstrating:
- Properties schema (title, content, author, etc.)
- Validation (required fields, length limits)
- Events (On Get, On Post, On Validate)
- Timestamps (createdAt, updatedAt)

**Properties** (config.json):
```json
{
  "type": "Collection",
  "properties": {
    "title": {
      "type": "string",
      "required": true
    },
    "content": {
      "type": "string",
      "required": true
    },
    "author": {
      "type": "string"
    },
    "published": {
      "type": "boolean",
      "default": false
    },
    "tags": {
      "type": "array"
    },
    "createdAt": {
      "type": "number"
    }
  }
}
```

**Validation** (validate.js):
```javascript
// Title validation
if (!this.title || this.title.trim().length === 0) {
  error('title', 'Title is required');
}

if (this.title && this.title.length > 200) {
  error('title', 'Title must be 200 characters or less');
}

// Content validation
if (!this.content || this.content.trim().length === 0) {
  error('content', 'Content is required');
}

// Set author if not provided
if (!this.author && me) {
  this.author = me.username;
}

// Set timestamp
if (!this.id) {
  this.createdAt = Date.now();
}
```

**On Get** (get.js):
```javascript
// Only show published articles to non-authenticated users
if (!me && !this.published) {
  cancel("This article is not published", 404);
}

// Hide draft articles from non-authors
if (!this.published && me && this.author !== me.username && !me.isAdmin) {
  cancel("Not authorized", 403);
}
```

#### Users Collection

**Location**: `.dpd/resources/users/`

A UserCollection demonstrating:
- Built-in authentication (login, logout, me)
- Password hashing
- Role-based access
- Email validation

**Properties** (config.json):
```json
{
  "type": "UserCollection",
  "properties": {
    "username": {
      "type": "string",
      "required": true
    },
    "email": {
      "type": "string",
      "required": true
    },
    "isAdmin": {
      "type": "boolean",
      "default": false
    },
    "profile": {
      "type": "object"
    }
  }
}
```

**Validation** (validate.js):
```javascript
// Email format validation
if (this.email && !this.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
  error('email', 'Invalid email format');
}

// Username requirements
if (this.username) {
  if (this.username.length < 3) {
    error('username', 'Username must be at least 3 characters');
  }
  if (!/^[a-zA-Z0-9_]+$/.test(this.username)) {
    error('username', 'Username can only contain letters, numbers, and underscore');
  }
}

// Password requirements
if (this.password) {
  if (this.password.length < 8) {
    error('password', 'Password must be at least 8 characters');
  }
}

// Prevent regular users from making themselves admin
if (this.isAdmin && (!me || !me.isAdmin)) {
  error('isAdmin', 'Only admins can set admin status');
}
```

#### Webhook Event

**Location**: `.dpd/resources/webhook/`

An Event resource demonstrating:
- Webhook endpoint
- API key authentication
- Custom response handling
- Header manipulation

**BeforeRequest** (beforerequest.js):
```javascript
// API key authentication
var apiKey = getHeader('x-api-key');

if (!apiKey) {
  cancel('API key required', 401);
}

// Validate API key (simplified - in production, check against database)
if (apiKey.length < 10) {
  cancel('Invalid API key', 403);
}

console.log('Authenticated request from API key:', apiKey.substring(0, 8) + '...');
```

**POST Handler** (post.js):
```javascript
// Validate payload
if (!body || !body.event) {
  cancel('Missing event in payload', 400);
}

// Log webhook receipt
console.log('Received webhook:', body.event);

// Process different event types
if (body.event === 'user.created') {
  console.log('New user created:', body.data);
  // Could notify admin, send email, etc.
}

// Store webhook data (optional)
// dpd.webhooks.post({
//   event: body.event,
//   data: body.data,
//   receivedAt: Date.now()
// });

// Return success response
setStatusCode(200);
setResult({
  success: true,
  event: body.event,
  processed: true,
  timestamp: Date.now()
});
```

### Server Scripts

#### development.js

Development server with detailed logging and auto-reload support.

```javascript
require('dotenv').config();

const deployd = require('deployd');

const server = deployd({
  port: process.env.PORT || 2403,
  env: 'development',
  db: {
    connectionString: process.env.MONGODB_URI || 'mongodb://localhost:27017/deployd-example'
  }
});

server.listen();

server.on('listening', function() {
  console.log('\n✅ Deployd server running');
  console.log('   Dashboard: http://localhost:' + server.options.port + '/dashboard');
  console.log('   API:       http://localhost:' + server.options.port + '/articles\n');
});

server.on('error', function(err) {
  console.error('❌ Server error:', err.message);
  process.exit(1);
});
```

#### production.js

Production server with health checks and graceful shutdown.

```javascript
require('dotenv').config();

const deployd = require('deployd');

const server = deployd({
  port: process.env.PORT || 3000,
  env: 'production',
  db: {
    connectionString: process.env.MONGODB_URI,
    connectionOptions: {
      serverSelectionTimeoutMS: 30000,
      tls: true,
      minPoolSize: 10,
      maxPoolSize: 100
    }
  }
});

server.listen();

server.on('listening', function() {
  console.log('Server listening on port', server.options.port);
  console.log('Health checks: /__health/live, /__health/ready');
  console.log('Metrics: /metrics');
});

server.on('error', function(err) {
  console.error('Server error:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received - shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
```

### Testing the Example

#### Create an Article

```bash
curl -X POST http://localhost:2403/articles \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My First Article",
    "content": "This is the content",
    "published": true
  }'
```

#### Get All Articles

```bash
curl http://localhost:2403/articles
```

#### Count Articles

```bash
curl http://localhost:2403/articles/count
```

#### Register a User

```bash
curl -X POST http://localhost:2403/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice",
    "email": "alice@example.com",
    "password": "password123"
  }'
```

#### Login

```bash
curl -X POST http://localhost:2403/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice",
    "password": "password123"
  }'
```

#### Test Webhook

```bash
curl -X POST http://localhost:2403/webhook \
  -H "Content-Type: application/json" \
  -H "x-api-key: test1234567890" \
  -d '{
    "event": "user.created",
    "data": {"userId": "123", "email": "user@example.com"}
  }'
```

### Customizing the Example

#### Add a New Collection

1. Create directory: `.dpd/resources/todos/`
2. Create config.json:
```json
{
  "type": "Collection",
  "properties": {
    "title": {"type": "string", "required": true},
    "completed": {"type": "boolean", "default": false}
  }
}
```
3. Restart server
4. Access at http://localhost:2403/todos

#### Add Event Script

1. Create `.dpd/resources/todos/post.js`:
```javascript
// Set timestamps
this.createdAt = Date.now();

// Set owner
if (me) {
  this.userId = me.id;
}
```
2. Save and test

### Next Steps

- Read [Building a Custom Run Script](/docs/server/run-script.md)
- Learn about [Collection Events](/docs/collections/adding-logic.md)
- Explore [Event Resource](/docs/using-modules/official/event.md)
- Set up [Production Deployment](/docs/server/production-deployment.md)

### Related Documentation

- [Installing Deployd](/docs/getting-started/installing-deployd.md)
- [Your First API](/docs/getting-started/your-first-api.md)
- [Collections](/docs/collections/)
- [Configuration Reference](/docs/server/configuration-reference.md)
