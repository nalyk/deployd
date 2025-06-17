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

    describe('.find({$limit: n}, fn)', function() {
      it('should limit the result', function(done) {
        store.insert([{i:1},{i:2},{i:3},{i:4},{i:5},{i:6},{i:7},{i:8},{i:9}], function () {
          store.find({$limit: 2}, function (err, result) {
            assert.ok(result);
            assert.equal(result.length, 2);
            done(err);
          });
        });
      });
    });

    describe('.find({$skip: n}, fn)', function() {
      it('should skip the n results', function(done) {
        store.insert([{i:1},{i:2},{i:33333},{i:4},{i:5},{i:6},{i:7},{i:8},{i:9}], function () {
          store.find({$skip: 2}, function (err, result) {
            assert.ok(result);
            assert.equal(result[0].i, 33333);
            done(err);
          });
        });
      });
    });

    describe('.find({$limit: "n"}, fn)', function() {
      it('should limit the result using integer value', function(done) {
        store.insert([{i:1},{i:2},{i:3},{i:4},{i:5},{i:6},{i:7},{i:8},{i:9}], function () {
          store.find({$limit: "2"}, function (err, result) {
            assert.ok(result);
            assert.equal(result.length, 2);
            done(err);
          });
        });
      });
    });

    describe('.find({$skip: n}, fn)', function() {
      it('should skip the result using integer value', function(done) {
        store.insert([{i:1},{i:2},{i:33333},{i:4},{i:5},{i:6},{i:7},{i:8},{i:9}], function () {
          store.find({$skip: "2"}, function (err, result) {
            assert.ok(result);
            assert.equal(result[0].i, 33333);
            done(err);
          });
        });
      });
    });

    describe('.count({}, fn)', function() {
      it('should count the results', function(done) {
        store.insert([{i:1},{i:2},{i:33333},{i:4},{i:5},{i:6},{i:7},{i:8},{i:9}], function () {
          store.count({}, function (err, result) {
            assert.ok(result);
            assert.equal(result, 9);
            done(err);
          });
        });
      });
    });
  });

  describe('.identify(object)', function() {
    it('should add an _id to the object', function() {
      var object = {};
      store.identify(object);
      assert.equal(object._id.length, 16);
    });

    it('should change _id to id', function() {
      var object = {_id: 'aaaaaaaabbbbbbbb'};
      store.identify(object);
      assert.equal(object.id.length, 16);
    });
  });

  describe('.remove(query, fn)', function(){
    it('should remove all the objects that match the query', function(done) {
      store.insert([{i:1},{i:2},{i:3}], function () {
        store.remove({i: {$lt: 3}}, function (err, result) {
          assert.equal(result.count, 2);
          store.find(function (err, result) {
            assert.equal(result.length, 1);
            done(err);
          });
        });
      });
    });

    it('should remove all the objects', function(done) {
      store.insert([{i:1},{i:2},{i:3}], function () {
        store.remove(function (err, result) {
          assert.equal(result.count, 3);
          store.find(function (err, result) {
            assert.deepStrictEqual(result, []);
            done(err);
          });
        });
      });
    });
  });

  describe('.insert(namespace, object, fn)', function(){
    it('should insert the given object into the namespace', function(done) {
      store.insert({testing: 123}, function (err, result) {
        assert.ok(result.id);
        assert.equal(result.testing, 123);
        done();
      });
    });

    it('should insert the given array into the namespace', function(done) {
      store.insert([{a:1}, {b:2}], function (err, result) {
        assert.equal(Array.isArray(result), true);
        assert.ok(result[0].id);
        assert.equal(result[0].a, 1);
        assert.ok(result[1].id);
        assert.equal(result[1].b, 2);
        assert.equal(result.length, 2);
        done(err);
      });
    });
  });

  describe('.update(query, updates, fn)', function(){
    it('should update only the properties provided', function(done) {
      store.insert({foo: 'bar'}, function (err, result) {
        assert.ifError(err);
        var query = {id: result.id};
        store.update(query, {foo: 'baz'}, function (err, updated) {
          assert.ifError(err);
          assert.equal(updated.count, 1);
          store.first(query, function (err, result) {
            assert.equal(result.foo, 'baz');
            done(err);
          });
        });
      });
    });

    it('should rename all objects', function(done) {
      store.insert([{foo: 'bar'}, {foo: 'bat'}, {foo: 'baz'}], function (err) {
        if(err) throw err;
        store.update({}, {$rename: {foo: 'RENAMED'}}, function (err, updated) {
          if(err) throw err;
          assert.equal(updated.count, 3);
          store.find(function (err, all) {
            all.forEach(function (item) {
              assert.ok(item.RENAMED);
              assert.equal(item.foo, undefined);
            });
            done(err);
          });
        });
      });
    });
  });

  describe('.rename(namespace, fn)', function(){
    it('should rename the underlying database representation of the store', function(done) {
      store.insert([{i:1},{i:2},{i:3}], function () {
        store.rename('foo-store', function () {
          store.find({i: {$lt: 3}}, function (err, result) {
            assert.ok(result);
            assert.equal(result.length, 2);
            store.rename('test-store', function () {
              store.find({i: {$lt: 3}}, function (err, result) {
                assert.ok(result);
                assert.equal(result.length, 2);
                done(err);
              });
            });
          });
        });
      });
    });
  });

  describe('.close()', function(){
    it('should close the connection without errors', function(done){
      tester.close().then(function(){
        assert.ok(!tester.Client);
        assert.ok(!tester.Db);
        done();
      }).catch(done);
    });
  });
});

after(function(done){
  tester.close().then(function(){ done(); }).catch(done);
});
