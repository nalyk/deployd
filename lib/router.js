var Context = require('./context')
  , escapeRegExp  = /[\-\[\]{}()+?.,\\\^$|#\s]/g
  , debug = require('debug')('router')
  , doh = require('doh')
  , error404 = doh.createResponder()
  , async = require('async');

/**
 * A `Router` routes incoming requests to the correct resource. It also initializes and
 * executes the correct methods on a resource.
 *
 * @param {Resource Array} resources
 * @api private
 */

function Router(resources, server) {
  this.resources = resources || [];
  this.server = server;
}

/**
 * Route requests to resources with matching root paths.
 * Generate a `ctx` object and hand it to the resource, along with the `res` by calling its `resource.handle(ctx, next)` method.
 * If a resource calls `next()`, move on to the next resource.
 *
 * If all matching resources call next(), or if the router does not find a resource, respond with `404`.
 *
 * @param {ServerRequest} req
 * @param {ServerResponse} res
 * @api public
 */

Router.prototype.route = function (req, res, next) {
  var router = this
    , server = this.server
    , url = req.url
    , resources = this.matchResources(url);

  if (req._routed) {
    return;
  }

  req._routed = true;

  // Handle session initialization for all resources
  async.series([function(fn) {
    async.forEach(router.resources, function(resource, fn) {
      if(resource.handleSession) {
        var ctx = new Context(resource, req, res, server);
        resource.handleSession(ctx, fn);
      } else {
        fn();
      }
    }, fn);
  }], function(err) {
    if (err) throw err;

    // Use async.eachSeries to iterate through resources without nextTick recursion
    // This eliminates the event loop pressure from deep nextTick chains
    var handled = false;

    async.eachSeries(resources, function(resource, nextResource) {
      // Skip if already handled by a previous resource
      if (handled) {
        return nextResource();
      }

      var ctx;
      var handler = doh.createHandler({req: req, res: res, server: server});

      handler.run(function () {
        debug('routing %s to %s', req.url, resource.path);
        ctx = new Context(resource, req, res, server);
        ctx.router = router;

        // default root to false
        if(ctx.session) ctx.session.isRoot = req.isRoot || false;

        // Track if response was sent to prevent calling nextResource after ctx.done()
        var originalDone = ctx.done;
        ctx.done = function() {
          handled = true;
          originalDone.apply(ctx, arguments);
        };

        // external functions
        var furl = ctx.url.replace('/', '');
        if(resource.external && resource.external[furl]) {
          // Wrap external function to prevent double-call edge case
          var externalDoneCalled = false;
          var wrappedDone = function() {
            if (externalDoneCalled) {
              debug('WARNING: done() called multiple times in external function %s - ignoring', furl);
              return;
            }
            externalDoneCalled = true;
            ctx.done.apply(ctx, arguments);
          };

          resource.external[furl](ctx.body, ctx, wrappedDone);

          // Use setImmediate to check if external function called done() synchronously
          setImmediate(function() {
            if (!handled && !externalDoneCalled) {
              nextResource(); // If external function didn't call done, try next resource
            }
          });
        } else {
          // Prevent double-call edge case: ensure next() callback can only be called once
          var nextCalled = false;
          resource.handle(ctx, function() {
            if (nextCalled) {
              debug('WARNING: next() called multiple times by resource %s - ignoring', resource.path);
              return;
            }
            nextCalled = true;
            // Resource called next(), try next resource
            nextResource();
          });
        }
      });
    }, function(err) {
      if (err) throw err;

      // No resource handled the request
      if (!handled) {
        if (next) {
          next();
        } else {
          debug('404 %s', req.url);
          res.statusCode = 404;
          error404({message: 'resource not found'}, req, res);
        }
      }
    });
  });

};


/**
 * Get resources whose base path matches the incoming URL, and order by specificness.
 * (So that /foo/bar will handle a request before /foo)
 *
 * @param {String} url
 * @param {Resource Array} matching resources
 * @api private
 */

Router.prototype.matchResources = function(url) {
  var router = this
    , result;

  debug('resources %j', this.resources.map(function(r) { return r.path; }));

  if (!this.resources || !this.resources.length) return [];

  result = this.resources.filter(function(d) {
    return url.match(router.generateRegex(d.path));
  }).sort(function(a, b) {
    return specificness(b) - specificness(a);
  });
  return result;
};

/**
 * Generates a regular expression from a base path.
 *
 * @param {String} path
 * @return {RegExp} regular expression
 * @api private
 */

Router.prototype.generateRegex = function(path) {
  if (!path || path === '/') path = '';
  path = path.replace(escapeRegExp, '\\$&');
  return new RegExp('^' + path + '(?:[/?].*)?$');
};

function specificness(resource) {
  var path = resource.path;
  if (!path || path === '/') path = '';
  return path.split('/').length;
}

module.exports = Router;
