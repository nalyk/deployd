var fs = require('fs')
    , path = require('path')
    , debug = require('debug')('server')
    , _ = require('underscore')
    , Router = require('./router')
    , db = require('./db')
    , io = require('socket.io')
    , Keys = require('./keys')
    , SessionStore = require('./session').SessionStore
    , setupReqRes = require('./util/http').setup
    , config = require('./config-loader')
    , logger = require('./util/logger');


/**
* Attach deployd router, sessions, db and functions into an existing http server instance.
* Make it possible to extend an express or socketIo server.
*
* The attached server instance consists of a handleRequest function which is an express middleware
*
* Options:
*
*   - `db`           the database connection info
*   - `socketIo`     the already created socket.io instance
*   - `host`         the server's hostname
*
* Properties:
*
*  - `sessions`      the servers `SessionStore`
*  - `sockets`       raw socket.io sockets
*  - `db`            the servers `Db` instance
*  - `handleRequest` express middleware
*
* Example:
*
*   var http = require('http');
*   var express = require('express');
*   var app = express();
*   var server = http.createServer(app);
*   var io = require('socket.io').listen(server, {'log level': 0});
*
*   var deployd = require('deployd')
*   deployd.attach(server, {socketIo: io, env: ENV, db:{host:'localhost', port:27015, name:'my-db'} } );
*   app.use(server.handleRequest);
*
*   server.listen();
*
* @param {Object} options
* @return {HttpServer}
*/
function attach(httpServer, options) {
  var server = process.server = httpServer;

  // defaults
  server.options = options = _.extend({
    db: {port: 27017, host: '127.0.0.1', name: 'deployd'}
  }, options);

  debug('started with options %j', options);

  // Track startup completion to distinguish startup vs runtime errors
  server.startupComplete = false;

  // an object to map a server to its stores
  server.stores = {};

  // back all memory stores with a db
  server.db = db.create(options.db);

  // use socket io for a session based realtime channel
  if (options.socketIo && options.socketIo.sockets) {
    server.sockets = options.socketIo.sockets;
  } else {
    // Socket.IO v4 configuration with CORS support
    var socketIoOptions = _.extend({
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      transports: ['websocket', 'polling']
    }, (server.options.socketIo && server.options.socketIo.options) || {});

    var socketIo = io(server, socketIoOptions);
    server.sockets = socketIo.sockets;
    if (server.options.socketIo && server.options.socketIo.adapter) {
      socketIo.adapter(server.options.socketIo.adapter);
    }
  }

  // persist sessions in a store
  server.sessions = new SessionStore('sessions', server.db, server.sockets, options.sessions);

  // persist keys in a store
  server.keys = new Keys();

  server.handleRequest = function handleRequest(req, res, nextMiddleware) {
    // dont handle socket.io requests
    if(req.url.indexOf('/socket.io/') === 0) return;
    debug('%s %s', req.method, req.url);

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
            req.cookies.set('sid', session.sid);
          }
          req.session = session;

          var root = req.headers['dpd-ssh-key'] || req.cookies.get('DpdSshKey');

          if (server.options.env === 'development') {
            if (root) {
              req.isRoot = true;
            }
            server.route(req, res, nextMiddleware);
          } else if (root) {
            // all root requests
            // must be authenticated
            debug('authenticating', root);
            server.keys.get(root, function(err, key) {
              if(err) throw err;
              if(key) req.isRoot = true;
              debug('is root?', session.isRoot);
              server.route(req, res, nextMiddleware);
            });
          } else {
            // normal route
            server.route(req, res, nextMiddleware);
          }
        }
      });
    });
  };


  var serverpath = server.options.server_dir || fs.realpathSync('./');

  // mkdir resourcesPath if not exists
  var resourcesPath = path.join(serverpath, 'resources');
  // use sync functions, as only run once when server start-up
  if (!fs.existsSync(resourcesPath)) {
    fs.mkdirSync(resourcesPath);
  }

  server.route = function route(req, res, next) {
    config.loadConfig(serverpath, server, function(err, resourcesInstances) {
      if (err) throw err;
      server.resources = resourcesInstances;
      var router = server.router = new Router(resourcesInstances, server);
      router.route(req, res, next);
    });
  };

  // lazy-load OR bootstrap load?
  // config.loadConfig('./', server, function(err, resourcesInstances) {
  //     if (err) {
  //         console.error();
  //         console.error("Error loading resources: ");
  //         console.error(err.stack || err);
  //         process.exit(1);
  //     } else {
  //         server.resources = resourcesInstances;
  //         var router = server.router = new Router(resourcesInstances, server);
  //     }
  // });


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




  /**
  * Create a new `Store` for persisting data using the database info that was passed to the server when it was created.
  *
  * Example:
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
  server.createStore = function(namespace) {
    return (this.stores[namespace] = this.db.createStore(namespace));
  };

  // Mark startup as complete - attach() completed successfully
  // Use nextTick to ensure all synchronous setup is done
  process.nextTick(function() {
    server.startupComplete = true;
    debug('Attach startup complete - now handling runtime errors gracefully');
  });

  return server;
}

module.exports = attach;
