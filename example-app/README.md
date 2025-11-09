# Deployd Example App

This is a simple example application demonstrating the deployd MongoDB 6+ fork.

## Structure

```
example-app/
├── resources/          # Your API resources (collections, endpoints)
│   ├── articles/       # Example articles collection
│   └── users/          # Example users collection
├── .dpd/              # Deployd configuration
├── .env.example       # Environment variables template
├── development.js     # Development server
├── production.js      # Production server
└── server.js          # Generic server script
```

## Quick Start

### 1. Set up environment

```bash
cp .env.example .env
# Edit .env with your MongoDB connection string
```

### 2. Run development server

```bash
node development.js
```

Visit http://localhost:2403/dashboard to access the dashboard.

### 3. Run production server

```bash
NODE_ENV=production MONGODB_URI=your-connection-string node production.js
```

## Resources

### Articles Collection
- Path: `/articles`
- Properties: `name` (string), `description` (string)
- Events: `validate.js`, `get.js`, `beforerequest.js`, `aftercommit.js`

### Users Collection
- Path: `/users`
- Extends UserCollection (built-in auth)

## Environment Variables

Create a `.env` file from `.env.example`:

```bash
# MongoDB Connection
MONGODB_URI=mongodb+srv://user:pass@host/database?options

# Server Port
PORT=2403

# Node Environment
NODE_ENV=development
```

## API Endpoints

Once running, your API is available at:

- **Collections**: http://localhost:2403/articles, http://localhost:2403/users
- **Client Library**: http://localhost:2403/dpd.js
- **Dashboard**: http://localhost:2403/dashboard (development only)

## Creating Resources

### Via Dashboard (Recommended)
1. Visit http://localhost:2403/dashboard
2. Click "Resources" → "Create"
3. Choose resource type (Collection, User Collection, Files, etc.)
4. Configure properties and events

### Manual Creation
Create a new directory in `resources/`:

```javascript
// resources/products/config.json
{
  "type": "Collection",
  "properties": {
    "name": {
      "type": "string",
      "required": true
    },
    "price": {
      "type": "number",
      "required": true
    }
  }
}
```

## Events

Add server-side logic with event scripts:

```javascript
// resources/products/validate.js
// Runs before creating/updating items
if (this.price < 0) {
  error('price', 'Price must be positive');
}

// resources/products/get.js
// Runs after fetching items
if (!me) {
  // Hide sensitive data for non-authenticated users
  hide('internalNotes');
}
```

Available events:
- `validate.js` - Validation before create/update
- `get.js` - After fetching data
- `post.js` - Before creating new item
- `put.js` - Before updating item
- `delete.js` - Before deleting item
- `beforerequest.js` - Before any request
- `aftercommit.js` - After database commit

## Authentication

The `users` collection extends UserCollection and provides built-in auth:

```javascript
// Login
POST /users/login
{
  "username": "user@example.com",
  "password": "secret"
}

// Logout
POST /users/logout

// Get current user
GET /users/me
```

## Client Library

Include the client library in your frontend:

```html
<script src="http://localhost:2403/dpd.js"></script>
<script>
  // CRUD operations
  dpd.articles.get(function(articles) {
    console.log(articles);
  });

  dpd.articles.post({name: 'New Article'}, function(result) {
    console.log('Created:', result);
  });

  // Real-time updates
  dpd.articles.on('create', function(article) {
    console.log('Article created:', article);
  });
</script>
```

## Learn More

- [Deployd Documentation](../../docs/deployd_docs/)
- [MongoDB 6+ Migration](../MODERNIZATION.md)
- [API Reference](../../docs/deployd_docs/server/)
