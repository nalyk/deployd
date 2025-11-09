<!--{
  title: 'Native Modules',
  tags: ['modules', 'native', 'integration']
}-->

## Native Modules

This modernized fork integrates several popular Deployd modules directly into the core framework. These modules are **built-in** and require **no installation**.

### Why Native?

Originally, these were separate npm packages that required manual installation. This fork integrates them as native resources for:

- **Zero Configuration**: No npm install needed
- **Automatic Loading**: Always available from type-loader
- **Better Integration**: Optimized for MongoDB 6+ and Socket.IO v4
- **Consistent Updates**: Updated alongside core framework
- **Smaller Bundle**: No duplicate dependencies

### Native Resource Types

#### Event Resource

**Original Package**: `dpd-event` (https://github.com/deployd/dpd-event)
**Status**: ✅ Native in this fork
**Location**: `lib/resources/event.js`

Create custom endpoints that execute event scripts without database persistence.

**Use Cases**:
- Webhooks and third-party API integrations
- Custom business logic and computed operations
- API proxies and data transformations
- Custom authentication endpoints

**Supported Events**:
- `GET` - Read operations
- `POST` - Create/submit operations
- `PUT` - Update operations
- `PATCH` - Partial updates
- `DELETE` - Delete operations
- `beforeRequest` - Authentication/validation before any HTTP method

**Domain Functions**:
- `url` - Request URL path
- `parts` - URL parts array
- `query` - Query string object
- `body` - Request body
- `getHeader(name)` - Get request header
- `setHeader(name, value)` - Set response header
- `setStatusCode(code)` - Set HTTP status code
- `setResult(value)` - Set response body

**Example Usage**:

Create Event resource:
```json
// .dpd/resources/webhook/config.json
{
  "type": "Event"
}
```

POST event script:
```javascript
// .dpd/resources/webhook/post.js
// Validate request
if (!body || !body.event) {
  cancel('Missing event field', 400);
}

// Log webhook
console.log('Webhook received:', body.event);

// Process event
if (body.event === 'user.created') {
  // Notify admin, send email, etc.
  dpd.admins.post({
    type: 'notification',
    message: 'New user: ' + body.data.email
  });
}

// Return success
setStatusCode(200);
setResult({
  success: true,
  event: body.event,
  timestamp: Date.now()
});
```

BeforeRequest event (authentication):
```javascript
// .dpd/resources/webhook/beforerequest.js
var apiKey = getHeader('x-api-key');

if (!apiKey) {
  cancel('API key required', 401);
}

if (apiKey !== 'your-secret-key') {
  cancel('Invalid API key', 403);
}

console.log('Authenticated request');
```

**Documentation**: [Event Resource](/docs/using-modules/official/event.md)

#### Count Endpoint (Collection Extension)

**Original Package**: `dpd-count` (https://github.com/deployd/dpd-count)
**Status**: ✅ Integrated into Collection resource
**Location**: `lib/resources/collection/index.js:895-962`

Adds `/count` endpoint to all Collection resources for efficient document counting.

**Features**:
- Automatic integration with all Collections
- Supports all query operators
- Runs `On Count` event if defined
- Returns `{count: N}` format

**HTTP API**:
```bash
GET /todos/count
# Response: {"count": 150}

GET /todos/count?completed=true
# Response: {"count": 42}

GET /todos/count?{"priority":{"$gte":5}}
# Response: {"count": 23}
```

**dpd.js API**:
```javascript
// Simple count
dpd.todos.get('count', function(result) {
  console.log('Total todos:', result.count);
});

// Count with query
dpd.todos.get('count', {completed: true}, function(result) {
  console.log('Completed:', result.count);
});

// Count with advanced query
dpd.todos.get('count', {
  priority: {$gte: 5},
  assignee: me.id
}, function(result) {
  console.log('My high-priority todos:', result.count);
});
```

**On Count Event**:
```javascript
// .dpd/resources/todos/count.js
// Restrict counting to own todos
if (!me) {
  cancel('Authentication required', 401);
}

// Modify query to filter by user
query.userId = me.id;
```

**Documentation**: [Count Endpoint](/docs/collections/count-endpoint.md)

#### Client Library

**Original Package**: `dpd-clientlib` (https://github.com/deployd/dpd-clientlib)
**Status**: ✅ Native in this fork
**Location**: `lib/clientlib.js` + `lib/clib/`

The dpd.js client library for browser-based API access.

**Features**:
- Socket.IO v4.8.1 client (upgraded from v1.7.4)
- 23% smaller bundle (61KB vs 80KB)
- Auto-loaded via `/dpd.js` endpoint
- Real-time event support
- Promise and callback support

**Automatic Availability**:
```html
<script src="/dpd.js"></script>
<script>
  // dpd object is now available
  dpd.todos.get(function(todos) {
    console.log('Todos:', todos);
  });
</script>
```

**Real-time Events**:
```javascript
dpd.todos.on('create', function(todo) {
  console.log('New todo:', todo);
});

dpd.todos.on('update', function(todo) {
  console.log('Updated todo:', todo);
});

dpd.todos.on('delete', function(todo) {
  console.log('Deleted todo:', todo);
});
```

**Version**: Socket.IO client 4.8.1 (minified, 61KB)
**Implementation**: lib/type-loader.js:44-48, lib/clientlib.js

#### Dashboard

**Original Package**: `dpd-dashboard` (https://github.com/deployd/dpd-dashboard)
**Status**: ✅ Native in this fork
**Location**: `lib/dashboard.js` + `lib/dashboard/`

The web-based dashboard for managing resources, data, and events.

**Features**:
- Resource management (create, edit, delete)
- Data browser with CRUD operations
- Event script editor
- API explorer
- Property schema editor
- User management

**Access**:
```
http://localhost:2403/dashboard
```

**Authentication**:
- **Development**: No authentication required (`env: 'development'`)
- **Production**: Requires API key (`dpd keygen` to create)

**Implementation**: lib/type-loader.js:49-51, lib/dashboard.js

### Migration from npm Packages

If you were using these as npm packages, follow these steps:

#### 1. Remove npm Packages

```bash
npm uninstall dpd-event dpd-count dpd-clientlib dpd-dashboard
```

#### 2. Update package.json

Remove from dependencies:
```json
{
  "dependencies": {
    "dpd-event": "*",       // REMOVE
    "dpd-count": "*",       // REMOVE
    "dpd-clientlib": "*",   // REMOVE
    "dpd-dashboard": "*"    // REMOVE
  }
}
```

#### 3. Clean Install

```bash
rm -rf node_modules package-lock.json
npm install
```

#### 4. No Code Changes

All modules are auto-loaded. No code changes needed!

#### 5. Verify

```bash
node development.js
# Visit http://localhost:2403/dashboard
# Check Event resource is available in dashboard
```

### Native Module Differences

#### Event Resource

| Feature | npm dpd-event | Native Event |
|---------|---------------|--------------|
| GET event | ✅ | ✅ |
| POST event | ✅ | ✅ |
| PUT event | ❌ | ✅ |
| PATCH event | ❌ | ✅ |
| DELETE event | ❌ | ✅ |
| beforeRequest | ❌ | ✅ |
| getHeader() | ❌ | ✅ |
| setHeader() | ❌ | ✅ |
| setStatusCode() | ❌ | ✅ |
| Debug logging | ❌ | ✅ |

#### Count Endpoint

| Feature | npm dpd-count | Native Count |
|---------|---------------|--------------|
| /count endpoint | ✅ | ✅ |
| Query support | ✅ | ✅ |
| On Count event | ❌ | ✅ |
| Debug logging | ❌ | ✅ |
| Modern MongoDB | ❌ | ✅ (countDocuments) |

#### Client Library

| Feature | npm dpd-clientlib | Native |
|---------|-------------------|--------|
| Socket.IO version | 1.7.4 | 4.8.1 |
| Bundle size | 80KB | 61KB |
| WebSocket support | Basic | Modern |
| CORS support | Limited | Full v4 |

### Type Loader Integration

All native modules are loaded via the type loader:

```javascript
// lib/type-loader.js:44-55

// Load native resource types
var nativeTypes = {
  'Event': require('./resources/event'),
  'Collection': require('./resources/collection'),
  'UserCollection': require('./resources/user-collection'),
  'Files': require('./resources/files'),
  'InternalResources': require('./resources/internal-resources'),
  'ClientLib': require('./clientlib'),
  'Dashboard': require('./dashboard')
};
```

**How it works**:
1. Type loader scans `lib/resources/` directory
2. Loads all `.js` files as resource types
3. Merges with external modules from `node_modules/`
4. Makes all types available in dashboard and API

### Creating Custom Resource Types

You can still create custom resource types:

```javascript
// node_modules/dpd-custom/index.js
var Resource = require('deployd/lib/resource');
var util = require('util');

function CustomResource(name, options) {
  Resource.apply(this, arguments);
}
util.inherits(CustomResource, Resource);

CustomResource.label = "Custom Resource";
CustomResource.events = ["get", "post"];

CustomResource.prototype.handle = function(ctx, next) {
  // Handle requests
  ctx.done(null, {message: 'Custom resource'});
};

module.exports = CustomResource;
```

Then install and use:
```bash
npm install dpd-custom
```

Resource will be auto-loaded and available in dashboard.

**Documentation**: [Creating Custom Resource Types](/docs/developing-modules/custom-resource-types.md)

### Related Documentation

- [Event Resource](/docs/using-modules/official/event.md)
- [Count Endpoint](/docs/collections/count-endpoint.md)
- [Using the Dashboard](/docs/using-modules/using-the-dashboard.md)
- [Creating Custom Resource Types](/docs/developing-modules/custom-resource-types.md)
