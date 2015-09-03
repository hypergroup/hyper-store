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
    store = new Store(new Client(root));
  });

  it('should work with a single context', function(done) {

    store.on('complete', function() {
      console.log(res.value, res.times);
      done();
    });

    var res = createContext(store, function(context) {
      var clas = context.get('.classes');

      return {
        length: context.get('length', clas),
        name: context.get('0.name', clas)
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

    var res1 = createContext(store, function(context) {
      return context.get('.classes', null, []).map(function(clas) {
        return context.get('name', clas);
      });
    });

    var res2 = createContext(store, function(context) {
      return context.get('.classes', null, []).map(function(clas) {
        return context.get('name', clas);
      });
    });

    var res3 = createContext(store, function(context) {
      return context.get('.classes', null, []).map(function(clas) {
        return context.get('name', clas);
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
});

function createContext(store, render) {
  var res = {
    times: 0
  };

  var context = store.context(exec);

  function exec() {
    context.start();
    var out = res.value = render(context);
    res.times++;
    context.stop();
    return out;
  }

  exec();

  return res;
}
