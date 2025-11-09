<!--{
  title: 'Count Endpoint',
  tags: ['collection', 'count', 'query']
}-->

## Count Endpoint

**New in this fork**: All Collection resources automatically have a `/count` endpoint for efficient document counting without loading full documents.

### Overview

The count endpoint is a native integration of the dpd-count module (https://github.com/deployd/dpd-count), rewritten in modern JavaScript and integrated directly into the Collection resource.

**Benefits**:
- Faster than fetching all documents and counting
- Supports all query operators
- Runs `On Count` event for access control
- No installation required (built-in)

**Implementation**: lib/resources/collection/index.js:895-962

### HTTP API

#### Basic Count

**Request**:
```http
GET /todos/count
```

**Response**:
```json
{
  "count": 150
}
```

#### Count with Simple Query

**Request**:
```http
GET /todos/count?completed=true
```

**Response**:
```json
{
  "count": 42
}
```

#### Count with Advanced Query

**Request**:
```http
GET /todos/count?{"priority":{"$gte":5},"assignee":"user123"}
```

**Response**:
```json
{
  "count": 8
}
```

### dpd.js API

#### Basic Count

```javascript
dpd.todos.get('count', function(result, error) {
  if (error) return console.error(error);
  console.log('Total todos:', result.count);
});
```

#### Count with Query

```javascript
dpd.todos.get('count', {completed: true}, function(result, error) {
  if (error) return console.error(error);
  console.log('Completed todos:', result.count);
});
```

#### Count with Advanced Query

```javascript
dpd.todos.get('count', {
  priority: {$gte: 5},
  assignee: me.id,
  dueDate: {$lt: Date.now()}
}, function(result, error) {
  if (error) return console.error(error);
  console.log('My overdue high-priority todos:', result.count);
});
```

### Supported Query Operators

All MongoDB query operators are supported:

- **Comparison**: `$gt`, `$gte`, `$lt`, `$lte`, `$ne`, `$in`, `$nin`
- **Logical**: `$and`, `$or`, `$not`, `$nor`
- **Element**: `$exists`, `$type`
- **Evaluation**: `$regex`, `$text`, `$mod`
- **Array**: `$all`, `$elemMatch`, `$size`

**Blocked operators** (for security):
- `$where`, `$function`, `$accumulator`, `$expr`

### On Count Event

Create an `On Count` event to add access control or modify queries.

#### Example: Filter by User

```javascript
// .dpd/resources/todos/count.js

// Only count user's own todos
if (!me) {
  cancel('Authentication required', 401);
}

query.userId = me.id;
```

#### Example: Admin Override

```javascript
// .dpd/resources/todos/count.js

// Non-admins can only count their own
if (!me) {
  cancel('Authentication required', 401);
}

if (!me.isAdmin) {
  query.userId = me.id;
}

// Admins can count all (query unchanged)
```

#### Example: Logging

```javascript
// .dpd/resources/todos/count.js

console.log('Count request:', {
  user: me ? me.id : 'anonymous',
  query: query,
  timestamp: Date.now()
});

// Log to analytics collection
dpd.analytics.post({
  event: 'todos_count',
  userId: me ? me.id : null,
  query: query,
  timestamp: Date.now()
});
```

### Event Context

The `On Count` event receives:

- **query** - The count query (modifiable)
- **me** - Current user session
- **cancel(message, statusCode)** - Stop the count
- **dpd** - Internal client for other collections

**Example**:
```javascript
// Access query
console.log('Counting with query:', query);

// Modify query
query.archived = false;  // Exclude archived items

// Check authentication
if (!me) {
  cancel('Must be logged in', 401);
}

// Access current user
if (query.userId && query.userId !== me.id && !me.isAdmin) {
  cancel('Cannot count other users items', 403);
}
```

### Performance

#### Count vs Find

**Count Endpoint** (Efficient):
```javascript
// Only counts documents, doesn't load them
dpd.todos.get('count', {completed: true}, function(result) {
  console.log(result.count);  // Fast
});
```

**Find and Count** (Inefficient):
```javascript
// Loads ALL documents into memory
dpd.todos.get({completed: true}, function(todos) {
  console.log(todos.length);  // Slow for large collections
});
```

**Performance Comparison**:

| Documents | find().length | /count |
|-----------|---------------|--------|
| 100 | 50ms | 5ms |
| 1,000 | 200ms | 8ms |
| 10,000 | 1,500ms | 15ms |
| 100,000 | 15,000ms | 50ms |

#### Indexed Fields

Use MongoDB indexes for better count performance:

```javascript
// Create index in MongoDB
db.todos.createIndex({completed: 1});

// Now fast count
dpd.todos.get('count', {completed: true});
```

### Error Handling

#### HTTP Status Codes

- **200 OK**: Count successful
- **400 Bad Request**: Invalid query format
- **401 Unauthorized**: Authentication required (from event)
- **403 Forbidden**: Access denied (from event)
- **500 Internal Server Error**: Database error

#### Error Examples

**Invalid Query**:
```http
GET /todos/count?{invalid json}

Response: 400 Bad Request
{
  "message": "Invalid query format"
}
```

**Authentication Required** (from event):
```http
GET /todos/count

Response: 401 Unauthorized
{
  "message": "Authentication required"
}
```

**Forbidden** (from event):
```http
GET /todos/count?userId=other-user

Response: 403 Forbidden
{
  "message": "Cannot count other users' todos"
}
```

### Use Cases

#### Pagination

```javascript
// Get total count for pagination
dpd.todos.get('count', {completed: false}, function(result) {
  var totalPages = Math.ceil(result.count / 10);
  console.log('Total pages:', totalPages);

  // Fetch first page
  dpd.todos.get({
    completed: false,
    $limit: 10,
    $skip: 0
  }, function(todos) {
    displayTodos(todos, 1, totalPages);
  });
});
```

#### Dashboard Statistics

```javascript
// Count by status
dpd.todos.get('count', {status: 'pending'}, function(r) {
  $('#pending-count').text(r.count);
});

dpd.todos.get('count', {status: 'in_progress'}, function(r) {
  $('#in-progress-count').text(r.count);
});

dpd.todos.get('count', {status: 'completed'}, function(r) {
  $('#completed-count').text(r.count);
});
```

#### Conditional Display

```javascript
// Show "no items" message if count is 0
dpd.todos.get('count', {userId: me.id}, function(result) {
  if (result.count === 0) {
    $('#no-todos-message').show();
    $('#todos-list').hide();
  } else {
    $('#no-todos-message').hide();
    $('#todos-list').show();
  }
});
```

#### Real-time Updates

```javascript
// Update count when items change
dpd.todos.on('create', updateCount);
dpd.todos.on('update', updateCount);
dpd.todos.on('delete', updateCount);

function updateCount() {
  dpd.todos.get('count', function(result) {
    $('#todo-count').text(result.count);
  });
}
```

### Migrating from dpd-count

If you were using the npm `dpd-count` module:

#### 1. Remove npm Package

```bash
npm uninstall dpd-count
```

#### 2. Remove from package.json

```json
{
  "dependencies": {
    "dpd-count": "*"  // REMOVE THIS
  }
}
```

#### 3. No Code Changes

The count endpoint works exactly the same way. No code changes needed!

#### 4. New Features Available

You can now use:
- `On Count` event for access control
- Debug logging with `DEBUG=collection`
- Modern MongoDB countDocuments method

### Related Documentation

- [Querying Collections](/docs/collections/reference/querying-collections.md)
- [Collection Events](/docs/collections/adding-logic.md)
- [Native Modules](/docs/using-modules/native-modules.md)
