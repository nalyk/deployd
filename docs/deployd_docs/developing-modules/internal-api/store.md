<!--{
  title: 'Store',
  tags: ['db', 'store', 'createStore']
}-->

## Store

An abstraction of a collection of objects in a database. Collections are HTTP wrappers around a `Store`. You can access or create a store the same way.

    var myStore = process.server.createStore('my-store');

**Modernization Note**: This fork uses MongoDB driver 6.10.0 with modern patterns:
- Promises-based operations (Bluebird promises)
- Modern CRUD methods (`insertOne`, `updateOne`, `deleteOne`, `countDocuments`)
- Circuit breaker pattern for database resilience (lib/db.js:108-127)
- Connection pooling (10-100 connections based on environment)

### Class: Store

You shouldn't construct `Store`s directly. Instead use the [process.server.createStore()](/docs/developing-modules/internal-api/server.md#s-Server.createStore-namespace) method.

All Store methods return **Bluebird promises** and accept traditional Node.js callbacks for backward compatibility.

#### Store.insert(object, fn) <!-- api -->

* `object` {Object}

The data to insert into the store.

* `fn(err, result)` {Function}

Called once the insert operation is finished.

**Implementation**: Uses MongoDB's `insertOne()` for single objects or `insertMany()` for arrays. Automatically generates a 24-character hex ID if not provided (lib/db.js:304-333).

**Example**:
```javascript
myStore.insert({title: 'Hello', count: 0}, function(err, result) {
  if (err) return console.error(err);
  console.log('Inserted:', result.id);
});

// Or with promises
myStore.insert({title: 'World', count: 1})
  .then(function(result) {
    console.log('Inserted:', result.id);
  })
  .catch(function(err) {
    console.error(err);
  });
```

#### Store.count(query, fn) <!-- api -->

* `query` {Object}

Only count objects that match this query.

* `fn(err, count)` {Function}

Called once the count operation is finished. `count` is a number.

**Implementation**: Uses MongoDB's modern `countDocuments()` method (lib/db.js:350-371). Supports all MongoDB query operators.

**Circuit Breaker**: Database operations are wrapped in a circuit breaker pattern to handle connection failures gracefully (lib/db.js:108-127). If MongoDB is unavailable, the circuit opens and fails fast until connectivity is restored.

#### Store.find(query, fn) <!-- api -->

* `query` {Object}

Only returns objects that match this query.

* `fn(err, results)` {Function}

Called once the find operation is finished.

#### Store.first(query, fn) <!-- api -->

* `query` {Object}

* `fn(err, result)` {Function}

Find the first object in the store that match the given query.

#### Store.update(query, changes, fn) <!-- api -->

* `query` {Object}

* `changes` {Object}

* `fn(err, updated)` {Function}

Update an object or objects in the store that match the given query only modifying the values in the given changes object.

**Implementation**: Uses MongoDB's `updateOne()` or `updateMany()` based on query (lib/db.js:475-522). Supports MongoDB update operators like `$set`, `$inc`, `$push`, `$pull`, plus custom operators like `$addUnique`.

**Connection Pooling**: Connections are reused from the pool (minPoolSize: 10-100 based on environment) for optimal performance (lib/db.js:204-215).

#### Store.remove(query, fn) <!-- api -->

* `query` {Object}

* `fn(err, updated)` {Function}

Remove an object or objects in the store that match the given query.

#### Store.rename(name, fn) <!-- api -->

* `name` {String}

* `fn(err)` {Function}

Rename the store.


