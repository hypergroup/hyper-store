/**
 * Module dependencies
 */

var should = require('should');
var Store = require('..');
var Client = require('hyper-client-superagent');

var root = 'http://class-roll.mazurka.io';

describe('hyper-store', function() {
  var store;
  beforeEach(function() {
    // if (store) store.destroy();
    // TODO add client
    var client = new Client(root);
    client.use(function(req) {
      console.log(req.method, req.url);
    });
    store = new Store(client);
  });

  it('should work with a single context', function(done) {

    store.on('complete', function() {
      console.log(res.value, res.times);
      done();
    });

    var res = createContext(store, function($get) {
      var clas = $get('.classes');

      return {
        length: $get('length', clas),
        name: $get('0.name', clas)
      };
    });
  });

  it('should work with multiple contexts', function(done) {

    store.on('complete', function() {
      console.log('RES1', res1.times);
      console.log('RES2', res2.times);
      console.log('RES3', res3.times);
      done();
    });

    var res1 = createContext(store, function($get) {
      return $get('.classes', null, []).map(function(clas) {
        return $get('name', clas);
      });
    });

    var res2 = createContext(store, function($get) {
      return $get('.classes', null, []).map(function(clas) {
        return $get('name', clas);
      });
    });

    var res3 = createContext(store, function($get) {
      return $get('.classes', null, []).map(function(clas) {
        return $get('name', clas);
      });
    });
  });

  it('should support getAsync', function(done) {
    store.getAsync({
      name_str: '.classes.0.name',
      name_fn: function($get) {
        return $get('.classes.0.name');
      },
      name_arr: [{href: root}, 'classes', '0', 'name']
    }, function(err, data) {
      if (err) return done(err);
      data.should.have.property('name_str');
      data.should.have.property('name_fn');
      data.should.have.property('name_arr');
      done();
    });
  });

  it('should support getAsync functions', function(done) {
    store.getAsync(function($get) {
      return $get('.classes', null, []).map(function(c) {
        return $get('name', c);
      });
    }, function(err, data) {
      if (err) return done(err);
      data.length.should.be.above(1);
      done();
    })
  })

  it('should support reloading resources', function(done) {
    var hasReloaded = false;

    var res = createContext(store, function($get) {
      var clas = $get('.classes.0');
      $get('name', clas);

      // we've successfully reloaded the href
      if (hasReloaded) return done();

      // still waiting on data
      if (!clas) return;

      // we've got the data; let's schedule a refresh
      hasReloaded = true;
      return store.reload(clas.href);
    });
  });
});

function createContext(store, render) {
  var res = {
    times: 0
  };

  var context = store.context(exec);

  function exec() {
    context.start();
    var out = res.value = render(context.get, context);
    res.times++;
    context.stop();
    return out;
  }

  exec();

  return res;
}
