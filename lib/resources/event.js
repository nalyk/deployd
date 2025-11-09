'use strict';

const Resource = require('../resource');
const util = require('util');
const debug = require('debug')('event');

/**
 * Event Resource
 *
 * Creates custom endpoints that execute event scripts without database persistence.
 * Useful for webhooks, API integrations, computed operations, and custom logic.
 *
 * Native integration of https://github.com/deployd/dpd-event
 */

function Event(name, options) {
  Resource.apply(this, arguments);
  debug('Created Event resource: %s', name);
}
util.inherits(Event, Resource);

Event.label = "Event";
Event.events = ["get", "post", "put", "patch", "delete", "beforeRequest"];

module.exports = Event;

Event.prototype.clientGeneration = true;

Event.prototype.handle = function(ctx, next) {
  const parts = ctx.url.split('/').filter(p => p);
  let result = {};

  // Create domain object for event scripts
  const domain = {
    url: ctx.url,
    parts: parts,
    query: ctx.query,
    body: ctx.body,
    'this': result,

    getHeader: function(name) {
      if (ctx.req.headers && typeof name === 'string' && name) {
        return ctx.req.headers[name.toLowerCase()];
      }
    },

    setHeader: function(name, value) {
      if (ctx.res.setHeader) {
        ctx.res.setHeader(name, value);
      }
    },

    setStatusCode: function(statusCode) {
      if (typeof statusCode !== 'number') {
        throw new TypeError('Status code must be a number');
      }
      ctx.res.statusCode = statusCode;
    },

    setResult: function(val) {
      if (typeof val === 'string' || typeof val === 'object') {
        result = val;
      } else {
        result = String(val);
      }
    }
  };

  const self = this;
  const method = ctx.method;

  debug('%s %s', method, ctx.url);

  // Execute BeforeRequest event if it exists
  if (this.events && this.events.beforeRequest) {
    debug('Running beforeRequest event');
    this.events.beforeRequest.run(ctx, domain, function(err) {
      if (err) {
        debug('beforeRequest error: %s', err.message || err);
        return ctx.done(err);
      }
      // Continue to method-specific event
      executeMethodEvent();
    });
  } else {
    executeMethodEvent();
  }

  function executeMethodEvent() {
    try {
      // Route to appropriate HTTP method event
      if (method === 'POST' && self.events.post) {
        debug('Running POST event');
        self.events.post.run(ctx, domain, function(err) {
          ctx.done(err, result);
        });
      } else if (method === 'GET' && self.events.get) {
        debug('Running GET event');
        self.events.get.run(ctx, domain, function(err) {
          ctx.done(err, result);
        });
      } else if (method === 'PUT' && self.events.put) {
        debug('Running PUT event');
        self.events.put.run(ctx, domain, function(err) {
          ctx.done(err, result);
        });
      } else if (method === 'PATCH' && self.events.patch) {
        debug('Running PATCH event');
        self.events.patch.run(ctx, domain, function(err) {
          ctx.done(err, result);
        });
      } else if (method === 'DELETE' && self.events.delete) {
        debug('Running DELETE event');
        self.events.delete.run(ctx, domain, function(err) {
          ctx.done(err, result);
        });
      } else {
        debug('No event handler for %s, calling next()', method);
        next();
      }
    } catch (err) {
      debug('Error executing event: %s', err.message || err);
      ctx.done(err);
    }
  }
};
