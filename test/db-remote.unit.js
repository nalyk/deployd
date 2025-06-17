var fs = require('fs')
  , db = require('../lib/db')
  , config = require(__dirname + '/support/db-remote.config.json')
  , tester = db.create(config)
  , store = tester.createStore('test-store')
  , assert = require('assert')
  , mongodb = require('mongodb');

var client;
var connectionString = 'mongodb://' + config.credentials.username + ':' +
  config.credentials.password + '@' + config.host + ':' + config.port + '/' + config.name;

before(function(done){
  client = new mongodb.MongoClient(connectionString);
  client.connect().then(function () {
    done();
  }).catch(done);
});

after(function(done){
  function finish(err){
    if (err) return done(err);
    if (client) {
      client.close().then(function(){ done(); }).catch(done);
    } else {
      done();
    }
  }
  tester.close().then(function(){ finish(); }).catch(finish);
});

beforeEach(function(done){
  store.remove(function () {
    store.find(function (err, result) {
      assert.equal(err, null);
      assert.equal(result.length, 0);
      done(err);
    });
  });
});

describe('db', function(){
  describe('.create(options)', function(){
    it('should connect to a remote database', function(done) {
      store.find(function (err, empty) {
        assert.equal(empty.length, 0);
        done(err);
      });
    });
  });
});

describe('store', function(){

  describe('.find(query, fn)', function(){
    it('should not find anything when the store is empty', function(done) {
      store.find(function (err, empty) {
        assert.equal(empty.length, 0);
        done(err);
      });
    });

    it('should pass the query to the underlying database', function(done) {
      store.insert([{i:1},{i:2},{i:3}], function () {
        store.find({i: {$lt: 3}}, function (err, result) {
          assert.equal(result.length, 2);
          result.forEach(function (obj) {
            assert.equal(typeof obj.id, 'string');
          });
          done(err);
        });
      });
    });

    // TODO: convert the rest of the tests
  });
});
