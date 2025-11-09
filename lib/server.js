var http = require('http')
  , Router = require('./router')
  , db = require('./db')
  , util = require('util')
  , Keys = require('./keys')
  , SessionStore = require('./session').SessionStore
  , fs = require('fs')
  , io = require('socket.io')
  , setupReqRes = require('./util/http').setup
  , debug = require('debug')('server')
  , config = require('./config-loader')
  , _ = require('underscore')
  , rateLimit = require('express-rate-limit')
  , metrics = require('./util/metrics')
  , logger = require('./util/logger');

function extend(origin, add) {
  // don't do anything if add isn't an object
  if (!add || typeof add !== 'object') return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    if(add[keys[i]]) origin[keys[i]] = add[keys[i]];
  }
  return origin;
}

/**
 * Create an http server with the given options and create a `Router` to handle its requests.
 *
 * Options:
 *
 *   - `db`           the database connection info
 *   - `host`         the server's hostname
 *   - `port`         the server's port
 *
 * Properties:
 *
 *  - `sessions`      the servers `SessionStore`
 *  - `sockets`       raw socket.io sockets
 *  - `db`            the servers `Db` instance
 *
 * Example:
 *
 *     var server = new Server({port: 3000, db: {host: 'localhost', port: 27015, name: 'my-db'}});
 *
 *     server.listen();
 *
 * @param {Object} options
 * @return {HttpServer}
 */

function Server(options) {
  var server = process.server = this;
  http.Server.call(this);

  // defaults
  this.options = options = extend({
    port: 2403,
    db: {port: 27017, host: '127.0.0.1', name: 'deployd'}
  }, options);

  debug('started with options %j', options);

  // Track startup completion to distinguish startup vs runtime errors
  this.startupComplete = false;

  // an object to map a server to its stores
  this.stores = {};

  // back all memory stores with a db
  this.db = db.create(options.db);

  // Socket.IO v4 configuration with CORS support
  var socketIoOptions = _.extend({
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
  }, (this.options.socketIo && this.options.socketIo.options) || {});

  var socketServer = io(this, socketIoOptions);

  // use socket io for a session based realtime channel
  this.sockets = socketServer.sockets;

  if (this.options.socketIo && this.options.socketIo.adapter) {
    socketServer.adapter(this.options.socketIo.adapter);
  }

  // persist sessions in a store
  this.sessions = new SessionStore('sessions', this.db, this.sockets, options.sessions);

  // persist keys in a store
  this.keys = new Keys();

  // Optional rate limiting (disabled by default, enable with options.rateLimit)
  // Example: {rateLimit: {windowMs: 60000, max: 100}} for 100 req/min
  if (options.rateLimit && options.rateLimit.enabled !== false) {
    var rateLimitConfig = _.extend({
      windowMs: 60 * 1000, // 1 minute window
      max: 100,            // 100 requests per window
      standardHeaders: true,
      legacyHeaders: false,
      message: {error: 'Too many requests, please try again later'},
      // Custom keyGenerator for native http.Server (doesn't have req.ip like Express)
      keyGenerator: function(req) {
        // Use X-Forwarded-For if behind proxy, otherwise connection remote address
        var ip = req.headers['x-forwarded-for']
          || (req.connection && req.connection.remoteAddress)
          || (req.socket && req.socket.remoteAddress)
          || 'unknown';
        return ip;
      },
      // Use request ID for logging
      handler: function(req, res) {
        var clientIp = req.headers['x-forwarded-for']
          || (req.connection && req.connection.remoteAddress)
          || 'unknown';
        debug('Rate limit exceeded for request %s from %s', req.id, clientIp);
        res.statusCode = 429;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          requestId: req.id
        }));
      }
    }, options.rateLimit);

    this.rateLimiter = rateLimit(rateLimitConfig);
    debug('Rate limiting enabled:', rateLimitConfig.max, 'requests per', rateLimitConfig.windowMs + 'ms');
  }

  this.on('request', server.handleRequest);

  // Production-grade error handling: distinguish startup vs runtime errors
  server.on('request:error', function (err, req, res) {
    logger.error('Request error', req, {
      error: err.message,
      stack: err.stack,
      method: req.method,
      url: req.url,
      startup: !server.startupComplete
    });

    // During startup, fail fast with process.exit
    if (!server.startupComplete) {
      logger.error('Fatal error during startup - exiting', null, {error: err.message});
      console.error('Fatal error during startup - exiting');
      process.exit(1);
    }

    // During runtime, send 500 error and continue serving other requests
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: 'Internal Server Error',
        message: server.options.env === 'development' ? err.message : undefined,
        requestId: req.id
      }));
    }
  });

  // Production-grade graceful shutdown handlers
  // Handle SIGTERM (sent by orchestrators like Kubernetes, Docker)
  process.on('SIGTERM', function() {
    debug('SIGTERM received - initiating graceful shutdown');
    console.log('SIGTERM received - shutting down gracefully...');

    server.close(function(err) {
      if (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
      }
      console.log('Graceful shutdown complete');
      process.exit(0);
    });

    // Force exit after timeout if graceful shutdown hangs
    setTimeout(function() {
      console.error('Shutdown timeout exceeded - forcing exit');
      process.exit(1);
    }, 30000); // 30 second timeout
  });

  // Handle SIGINT (Ctrl+C in terminal)
  process.on('SIGINT', function() {
    debug('SIGINT received - initiating graceful shutdown');
    console.log('\nSIGINT received - shutting down gracefully...');

    server.close(function(err) {
      if (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
      }
      console.log('Graceful shutdown complete');
      process.exit(0);
    });

    // Force exit after timeout
    setTimeout(function() {
      console.error('Shutdown timeout exceeded - forcing exit');
      process.exit(1);
    }, 30000);
  });
}
util.inherits(Server, http.Server);

Server.prototype.handleRequest = function handleRequest (req, res) {
  var server = this;
  // dont handle socket.io requests
  if(req.url.indexOf('/socket.io/') === 0) return;

  debug('%s %s', req.method, req.url);

  // Apply rate limiting if enabled
  if (server.rateLimiter) {
    return server.rateLimiter(req, res, function() {
      server._handleRequestAfterRateLimit(req, res);
    });
  }

  server._handleRequestAfterRateLimit(req, res);
};

Server.prototype._handleRequestAfterRateLimit = function(req, res) {
  var server = this;

  // Track HTTP request metrics
  metrics.trackHttpRequest(req, res, function() {
    // Continue with normal request handling
  });

  // add utilites to req and res
  setupReqRes(server.options, req, res, function(err, next) {
    if(err) return res.end(err.message);

    var authToken, usesBearerAuth = false;
    if (req.headers && req.headers.authorization) {
      var parts = req.headers.authorization.split(' ');
      var scheme = parts[0]
      , credentials = parts[1];

      if (/^Bearer$/i.test(scheme)) {
        authToken = credentials;
        usesBearerAuth = true;
      }
    }

    server.sessions.createSession(authToken || req.cookies.get('sid'), function(err, session) {
      if(err) {
        debug('session error', err, session);
        throw err;
      } else {
        if (!usesBearerAuth) {
          // (re)set the session id cookie if we're not using Authorization Bearer
          if (session.sid) req.cookies.set('sid', session.sid);
        }
        req.session = session;

        var root = req.headers['dpd-ssh-key'] || req.cookies.get('DpdSshKey');

        if (server.options.env === 'development') {
          if (root) { req.isRoot = true; }
          server.route(req, res);
        } else if (root) {
          // all root requests
          // must be authenticated
          debug('authenticating', root);
          server.keys.get(root, function(err, key) {
            if(err) throw err;
            if(key) req.isRoot = true;
            debug('is root?', session.isRoot);
            server.route(req, res);
          });
        } else {
          // normal route
          server.route(req, res);
        }
      }
    });
  });
};

/**
 * Start listening for incoming connections.
 *
 * @return {Server} for chaining
 */

Server.prototype.listen = function(port, host) {
  var server = this;
  var serverpath = server.options.server_dir || fs.realpathSync('./');

  config.loadConfig(serverpath, server, function(err, resourcesInstances) {
    if (err) {
      console.error();
      console.error("Error loading resources: ");
      console.error(err.stack || err);
      process.exit(1);
    } else {
      server.resources = resourcesInstances;
      var router = new Router(resourcesInstances, server);
      server.router = router;
      http.Server.prototype.listen.call(server, port || server.options.port, host || server.options.host);

      // Mark startup as complete after server starts listening
      server.once('listening', function() {
        server.startupComplete = true;

        // Production-grade HTTP Keep-Alive configuration
        // Keeps connections open for reuse, reducing latency
        server.keepAliveTimeout = 65000; // 65 seconds (longer than typical load balancer timeout)
        server.headersTimeout = 66000;   // Slightly higher than keepAliveTimeout

        debug('Server startup complete - now handling runtime errors gracefully');
        debug('HTTP Keep-Alive enabled: keepAliveTimeout=%dms, headersTimeout=%dms',
          server.keepAliveTimeout, server.headersTimeout);
      });
    }
  });
  return this;
};

Server.prototype.route = function route (req, res) {
  var server = this;

  // Health check endpoints (don't require routing)
  if (req.url === '/__health/live') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({status: 'ok', timestamp: Date.now()}));
    return;
  }

  if (req.url === '/__health/ready') {
    // Check if database is connected
    var dbReady = server.db && server.db.Db ? true : false;
    var status = dbReady ? 'ready' : 'not ready';
    res.statusCode = dbReady ? 200 : 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      status: status,
      checks: {database: dbReady},
      timestamp: Date.now()
    }));
    return;
  }

  if (req.url === '/__health/startup') {
    var status = server.startupComplete ? 'started' : 'starting';
    res.statusCode = server.startupComplete ? 200 : 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({status: status, timestamp: Date.now()}));
    return;
  }

  // Prometheus metrics endpoint
  if (req.url === '/metrics' || req.url === '/__metrics') {
    res.statusCode = 200;
    res.setHeader('Content-Type', metrics.register.contentType);

    // metrics() returns a Promise in prom-client >= 14
    var metricsPromise = metrics.getMetrics();
    if (metricsPromise && typeof metricsPromise.then === 'function') {
      metricsPromise.then(function(data) {
        res.end(data);
      }).catch(function(err) {
        res.statusCode = 500;
        res.end('Error generating metrics: ' + err.message);
      });
    } else {
      res.end(metricsPromise);
    }
    return;
  }

  // In production, use cached router to avoid filesystem reads and router recreation on every request
  // In development, reload config to support hot-reloading of resources
  if (server.router && server.options.env !== 'development') {
    return server.router.route(req, res);
  }

  var serverpath = server.options.server_dir || './';

  config.loadConfig(serverpath, server, function(err, resourcesInstances) {
    if (err) throw err;

    // Only recreate router in development mode or on first request
    if (!server.router || server.options.env === 'development') {
      server.router = new Router(resourcesInstances, server);
    }

    server.resources = resourcesInstances;
    server.router.route(req, res);
  });
};

/**
 * Create a new `Store` for persisting data using the database info that was passed to the server when it was created.
 *
 * Example:
 *
 *     // Create a new server
 *     var server = new Server({port: 3000, db: {host: 'localhost', port: 27015, name: 'my-db'}});
 *
 *     // Attach a store to the server
 *     var todos = server.createStore('todos');
 *
 *     // Use the store to CRUD data
 *     todos.insert({name: 'go to the store', done: true}, ...); // see `Store` for more info
 *
 * @param {String} namespace
 * @return {Store}
 */

Server.prototype.createStore = function(namespace) {
	return (this.stores[namespace] = this.db.createStore(namespace));
};

/**
 * Gracefully close the server and all its connections.
 * Closes HTTP server, Socket.IO, and MongoDB connections.
 *
 * @param {Function} callback - Called when shutdown is complete
 */
Server.prototype.close = function(callback) {
  var server = this;
  var httpClose = http.Server.prototype.close.bind(this);

  debug('closing server...');

  // Close HTTP server first (stops accepting new connections)
  httpClose(function(err) {
    if (err) {
      debug('error closing http server:', err);
      if (callback) return callback(err);
      return;
    }

    debug('http server closed');

    // Close Socket.IO connections (v4 API)
    if (server.sockets && server.sockets.server) {
      debug('closing socket.io...');
      try {
        // In Socket.IO v4, we need to close all client connections first
        server.sockets.disconnectSockets(true);
        server.sockets.server.close();
        debug('socket.io closed');
      } catch (e) {
        debug('error closing socket.io:', e);
      }
    }

    // Close database connection
    if (server.db && typeof server.db.close === 'function') {
      debug('closing database...');
      server.db.close(function(dbErr) {
        if (dbErr) {
          debug('error closing database:', dbErr);
        } else {
          debug('database closed');
        }
        if (callback) callback(dbErr);
      });
    } else {
      debug('no database to close');
      if (callback) callback();
    }
  });
};

module.exports = Server;
