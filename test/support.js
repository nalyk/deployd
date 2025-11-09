/**
 * Dependencies
 */

expect = require('chai').expect;
axios = require('axios');
http = require('http');

// Load environment variables from .env file
require('dotenv').config({path: __dirname + '/.env'});

// MongoDB configuration for tests
// Use remote MongoDB if MONGODB_URI is set, otherwise localhost
process.env.MONGODB_URI = process.env.MONGODB_URI || process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/deployd-test';

TEST_DB = process.env.MONGODB_URI || {name: 'test-db', host: 'localhost', port: 27017};
mongodb = require('mongodb');
var Stream = require('stream');
sh = require('shelljs');

// Axios wrapper to maintain compatibility with 'request' library API
request = function(options, callback) {
  var axiosOptions = {
    url: options.url || options.uri,
    method: options.method || 'GET',
    headers: options.headers || {},
    data: options.body || options.json,
    maxRedirects: 5,
    validateStatus: function() { return true; } // Don't throw on any status
  };

  axios(axiosOptions)
    .then(function(response) {
      callback(null, {
        statusCode: response.status,
        headers: response.headers,
        body: typeof response.data === 'object' ? JSON.stringify(response.data) : response.data
      }, response.data);
    })
    .catch(function(error) {
      callback(error, null, null);
    });
};

// port generation
genPort = function() {
  var min = 6666, max = 9999;
  var result = min + (Math.random() * (max - min));
  return Math.floor(result);
};


// request mock
freq = function(url, options, fn, callback) {
  var port = genPort();
  options = options || {};
  options.url = 'http://localhost:' + port + url;
  var s = http.createServer(function (req, res) {
    if(callback) {
      var end = res.end;
      res.end = function () {

        var r = end.apply(res, arguments);
        s.close();
        return r;
      };
    } else {
      s.close();
    }
    fn(req, res);
  })
  .listen(port)
  .on('listening', function () {
    request(options, function (){
      if (callback) {
        callback.apply(null, arguments);
      }
    });
  });
};

before(function (done) {
  var url = 'mongodb://' + TEST_DB.host + ':' + TEST_DB.port;
  var client = new mongodb.MongoClient(url);
  client.connect()
    .then(function () {
      return client.db(TEST_DB.name).dropDatabase();
    })
    .then(function () {
      client.close();
      done();
    })
    .catch(function (err) {
      done(err);
    });
});


/**
 * Utility for easily testing resources with mock contexts
 *
 * Inputs:
 *  - url (relative to the base path)
 *  - query object
 *  - body object or stream
 *  - headers object
 *  - method (get,post,put,delete,etc)
 *
 * Output:
 *   Should be what context.done should be called with
 *
 * Behavior:
 *  - error true if should expect an error
 *  - next should call next if
 */

var ServerRequest = require('http').ServerRequest
  , ServerResponse = require('http').ServerResponse;

fauxContext = function(resource, url, input, expectedOutput, behavior) {
  input = input || {};
  var context = {
    url: url,
    body: input.body,
    query: input.query,
    done: function(err, res) {
      if(behavior && behavior.next) throw new Error('should not call done');
      if(expectedOutput && typeof expectedOutput == 'object') expect(res).to.eql(expectedOutput);
      context.done = function() {
        throw 'done called twice...';
      };
      if(behavior && behavior.done) behavior.done(err, res);
    },
    res: input.res || new ServerResponse(new ServerRequest())
  };

  context.res.end = function() {
    context.done();
  };

  function next(err) {
    if(!(behavior && behavior.next)) {
      throw new Error('should not call next');
    }
    if(behavior && behavior.done) behavior.done(err);
  }

  resource.handle(context, next);
};
