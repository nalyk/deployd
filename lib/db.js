var db = module.exports = {}
  , util = require('util')
  , EventEmitter = require('events').EventEmitter
  , mongodb = require('mongodb')
  , uuid = require('./util/uuid')
  , scrub = require('scrubber').scrub
  , debug = require('debug')('db')
  , url = require('url')
  , Promise = require('bluebird')
  , _ = require('underscore');

require("debug").enable("db:error");
var error = require('debug')('db:error');

/**
 * Create a new database with the given options. You can start making
 * database calls right away. They are internally buffered and executed once the
 * connection is resolved.
 *
 * Options:
 *
 *   - `name`         the database name
 *   - `host`         the database host
 *   - `port`         the database port
 *
 * Example:
 *
 *     db
 *       .create({host: 'localhost', port: 27015, name: 'test'})
 *       .createStore('testing-store')
 *       .insert({foo: 'bar'}, fn)
 *
 * @param {Object} options
 * @return {Db}
 */

db.create = function (options) {
  var db = new Db(options);
  return db;
};

/**
 * A `Db` abstracts a driver implementation of the database. This allows for
 * a single interface to be used against any database implementation.
 *
 * Example:
 *
 *     var redis = require('redis');
 *
 *     function Redis(options) {
 *       this.options = options;
 *       this._redis = redis.createClient()
 *     }
 *     util.inherits(Redis, Db);
 *
 *     Redis.prototype.open = function (fn) {
 *       this._redis.once('ready', fn);
 *     }
 *
 * @param {Object} options
 * @api private
 */

function Db(options) {
  this.options = options;
  this.connectionString = this.options.connectionString;
  // MongoClient expects an options object; passing `null` causes a
  // TypeError in recent MongoDB drivers. Default to an empty object
  // so the driver can apply its own defaults when no options are
  // provided.
  this.connectionOptions = this.options.connectionOptions || {};
  if (!this.connectionString && this.options.host) {
    this.connectionString = url.format({
      protocol: "mongodb",
      slashes: true,
      hostname: this.options.host,
      port: this.options.port,
      auth: this.options.credentials ? this.options.credentials.username + ":" + this.options.credentials.password : null,
      pathname: this.options.name
    });
  }
}
util.inherits(Db, EventEmitter);
db.Db = Db;

/**
 * Drop the underlying database.
 *
 * @param {Function} callback
 * @api private
 */

Db.prototype.drop = function (fn) {
  getConnection(this)
    .then(function (mdb) {
      return mdb.dropDatabase();
    })
    .then(function () {
      if (fn) fn();
    })
    .catch(function (err) {
      if (fn) fn(err);
    });
};

/**
 * Create a new database store (eg. a collection).
 *
 * Example:
 *
 *     db
 *       .connect({host: 'localhost', port: 27015, name: 'test'})
 *       .createStore('testing-store')
 *       .insert({foo: 'bar'}, fn)
 *
 * @param {String} namespace
 * @return {Store}
 */

Db.prototype.createStore = function (namespace) {
  return new Store(namespace, this);
};

/**
 * Initialize a space in the database (eg. a collection).
 *
 * @param {String} namespace
 * @param {Db} db
 * @api private
 */

function Store(namespace, db) {
  this.namespace = namespace;
  this._db = db;
}
module.exports.Store = Store;

function getConnection(db) {
  if (db.Db) return Promise.resolve(db.Db); // reuse connection
  if (typeof db.connectionString !== "string" || db.connectionString.length === 0) {
    error(new Error("Cannot initialize store. A proper connection string was not specified."));
    process.exit(1);
  }
  // Create a MongoClient instance first and then connect. This mirrors the
  // current recommended usage of the MongoDB driver.
  var client = new mongodb.MongoClient(db.connectionString, db.connectionOptions);
  return client.connect()
    .then(function () {
      // store the connected client and db instance for reuse
      db.Client = client;
      db.Db = client.db();
      return db.Db;
    })
    .catch(function (err) {
      error(new Error("Cannot open store: " + err));
      throw "Database connection error";
    });
}

function collection(store, fn) {
  var db = store._db;

  return getConnection(db)
    .then(function (mdb) {
      try {
        var col = mdb.collection(store.namespace);
        if (fn) fn(null, col);
        return col;
      } catch (err) {
        error(err || new Error('Unable to get ' + store.namespace + ' collection'));
        if (fn) fn(err);
        throw err;
      }
    })
    .catch(function (err) {
      if (fn) fn(err);
      throw err;
    });
}

/**
 * Returns a promise, or calls fn with the mongo collection served by this store
 * @param  {Function} fn   a callback that will receive the mongo collection as the second parameter
 * @return {Promise}       returns a promise with the mongo collection
 */
Store.prototype.getCollection = function(fn){
  return collection(this, fn);
};

/**
 * Change public IDs to private IDs.
 *
 * IDs are generated with a psuedo random number generator.
 * 24 hexidecimal chars, ~2 trillion combinations.
 *
 * @param {Object} object
 * @return {Object}
 * @api private
 */

Store.prototype.identify = function (object) {
  if(!object) return;
  if(typeof object != 'object') throw new Error('identify requires an object');
  var store = this;
  function set(object) {
    if(object._id) {
      object.id = object._id;
      delete object._id;
    } else {
      var u = object.id || store.createUniqueIdentifier();
      object._id = u;
      delete object.id;
    }
  }
  if(Array.isArray(object)) {
    object.forEach(set);
  } else {
    set(object);
  }
  return object;
};


/**
 * Change query IDs to private IDs.
 *
 * @param {Object} object
 * @return {Object}
 * @api private
 */

Store.prototype.scrubQuery = function (query) {
  // private mongo ids can be anywhere in a query object
  // walk the object recursively replacing id with _id
  // NOTE: if you are implementing your own Store,
  // you probably wont need to do this if you want to store ids
  // as 'id'

  if(query.id && typeof query.id === 'object') {
    query._id = query.id;
    delete query.id;
  }

  try {
    scrub(query, function (obj, key, parent, type) {
      // find any value using _id
      if(key === 'id' && parent.id) {
        parent._id = parent.id;
        delete parent.id;
      }
    });
  } catch(ex) {
    debug(ex);
  }

};

/**
 * Create a unique identifier. Override this in derrived stores
 * to change the way IDs are generated.
 *
 * @return {String}
 */

Store.prototype.createUniqueIdentifier = function() {
  return uuid.create();
};

/**
 * Insert an object into the store.
 *
 * Example:
 *
 *     db
 *       .connect({host: 'localhost', port: 27015, name: 'test'})
 *       .createStore('testing-store')
 *       .insert({foo: 'bar'}, fn)
 *
 * @param {Object|Array} object
 * @param {Function} callback(err, obj)
 */

Store.prototype.insert = function (object, fn) {
  if (Array.isArray(object) && object.length === 0) {
    // mongodb client combatibility, empty arrays not allowed any more
    fn(null, null);
    return;
  }

  var store = this;
  this.identify(object);
  collection(this)
    .then(function (col) {
      if (Array.isArray(object)) {
        return col.insertMany(object).then(function () {
          return object;
        });
      }
      return col.insertOne(object).then(function () {
        return object;
      });
    })
    .then(function (docs) {
      if (Array.isArray(docs) && !Array.isArray(object)) {
        docs = docs[0];
      }
      fn(null, store.identify(docs));
    })
    .catch(function (err) {
      fn(err);
    });
};


/**
 * Find the number of objects in the store that match the given query.
 *
 * Example:
 *
 *     db
 *       .connect({host: 'localhost', port: 27015, name: 'test'})
 *       .createStore('testing-store')
 *       .count({foo: 'bar'}, fn)
 *
 * @param {Object} query
 * @param {Function} callback(err, num)
 */

Store.prototype.count = function(query, fn) {
  
  if (typeof query == 'function') {
    fn = query;
    query = {};
  } else {
    query && this.scrubQuery(query);
  }

  var options = stripOptions(query);

  collection(this)
    .then(function (col) {
      return col.countDocuments(query, options);
    })
    .then(function (count) {
      fn(null, count);
    })
    .catch(function (err) {
      fn(err);
    });
};

/**
 * Find all objects in the store that match the given query.
 *
 * Example:
 *
 *     db
 *       .connect({host: 'localhost', port: 27015, name: 'test'})
 *       .createStore('testing-store')
 *       .find({foo: 'bar'}, fn)
 *
 * @param {Object} query
 * @param {Function} callback(err, obj)
 */

Store.prototype.find = function (query, fn) {
  var store = this;
  if(typeof query == 'function') {
    fn = query;
    query = {};
  } else {
    query && this.scrubQuery(query);
  }

  // fields
  var fields = stripFields(query);
  var options = stripOptions(query);
  if (fields && _.isObject(fields)) {
    options.projection = fields;
  }

  collection(this)
    .then(function (col) {
      if (typeof query._id === 'string') {
        return col.findOne(query, options).then(function (obj) {
          store.identify(query);
          return store.identify(obj);
        });
      }
      return col.find(query, options).toArray().then(function (arr) {
        return store.identify(arr);
      });
    })
    .then(function (result) {
      fn(null, result);
    })
    .catch(function (err) {
      fn(err);
    });
};

/**
 * Find the first object in the store that match the given query.
 *
 * Example:
 *
 *     db
 *       .connect({host: 'localhost', port: 27015, name: 'test'})
 *       .createStore('testing-store')
 *       .first({foo: 'bar'}, fn)
 *
 * @param {Object} query
 * @param {Function} callback(err, obj)
 */

Store.prototype.first = function (query, fn) {
  query && this.scrubQuery(query);

  var store = this
    , fields = stripFields(query);

  var options = {};
  if (fields && _.isObject(fields)) {
    options.projection = fields;
  }

  collection(this)
    .then(function (col) {
      return col.findOne(query, options);
    })
    .then(function (result) {
      fn(null, store.identify(result));
    })
    .catch(function (err) {
      fn(err);
    });
};

/**
 * Update an object or objects in the store that match the given query.
 *
 * Example:
 *
 *     db
 *       .connect({host: 'localhost', port: 27015, name: 'test'})
 *       .createStore('testing-store')
 *       .update({id: '<an object id>'}, fn)
 *
 * @param {Object} query
 * @param {Object} object
 * @param {Function} callback(err, obj)
 */

Store.prototype.update = function (query, object, fn) {
  var store = this
    , multi = false
    , command = {};

  if(typeof query == 'string') query = {id: query};
  if(typeof query != 'object') throw new Error('update requires a query object or string id');
  if(query.id) {
    store.identify(query);
  }  else {
    multi = true;
  }

  stripFields(query);

  //Move $ queries outside of the $set command
  Object.keys(object).forEach(function(k) {
    if (k.indexOf('$') === 0) {
      command[k] = object[k];
      delete object[k];
    }
  });

  if(Object.keys(object).length) {
    command.$set = object;
  }

  multi = query._id ? false : true;

  debug('update - query', query);
  debug('update - object', object);
  debug('update - command', command);

  collection(this)
    .then(function (col) {
      if (multi) {
        return col.updateMany(query, command);
      }
      return col.updateOne(query, command);
    })
    .then(function (r) {
      store.identify(query);
      fn(null, r ? { count: r.modifiedCount } : null);
    })
    .catch(function (err) {
      fn(err);
    });
};

/**
 * Remove an object or objects in the store that match the given query.
 *
 * Example:
 *
 *     db
 *       .connect({host: 'localhost', port: 27015, name: 'test'})
 *       .createStore('testing-store')
 *       .remove({id: '<an object id>'}, fn)
 *
 * @param {Object} query
 * @param {Function} callback(err, obj)
 */

Store.prototype.remove = function (query, fn) {
  var store = this;
  if(typeof query === 'string') query = {id: query};
  if(typeof query == 'function') {
    fn = query;
    query = {};
  }
  if(query.id) {
    store.identify(query);
  }
  collection(this)
    .then(function (col) {
      if (query._id) {
        return col.deleteOne(query);
      }
      return col.deleteMany(query);
    })
    .then(function (r) {
      fn(null, r ? { count: r.deletedCount } : null);
    })
    .catch(function (err) {
      fn(err);
    });
};

/**
 * Rename the store.
 *
 * Example:
 *
 *     db
 *       .connect({host: 'localhost', port: 27015, name: 'test'})
 *       .createStore('testing-store')
 *       .rename('renamed-store', fn)
 *
 * @param {String} namespace
 * @param {Function} callback(err, obj)
 */

Store.prototype.rename = function (namespace, fn) {
  var store = this;
  collection(this)
    .then(function (col) {
      store.namespace = namespace;
      return col.rename(namespace);
    })
    .then(function () {
      if (fn) fn();
    })
    .catch(function (err) {
      if (fn) fn(err);
    });
};

function stripFields(query) {
  if(!query) return;
  var fields = query.$fields;
  if(fields) delete query.$fields;
  return fields;
}

function stripOptions(query) {
  var options = {};
  if(!query) return options;
  // performance
  if(query.$limit) options.limit = parseInt(query.$limit);
  if(query.$skip) options.skip = parseInt(query.$skip);
  if(query.$sort || query.$orderby) options.sort = query.$sort || query.$orderby;
  delete query.$limit;
  delete query.$skip;
  delete query.$sort;
  return options;
}
