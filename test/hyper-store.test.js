/**
 * Module dependencies
 */

var should = require('should');
var Store = require('..');
var Client = require('hyper-client-superagent');

describe('hyper-store', function() {
  var store;
  beforeEach(function() {
    // if (store) store.destroy();
    // TODO add client
    store = new Store(new Client('https://app.qzzr.com/api/hyper'));
  });

  it('should work with a single context', function(done) {

    store.on('complete', function() {
      console.log(res.value, res.times);
      done();
    });

    var res = createContext(store, function(context) {
      var quiz = context.get('.quizzes.trending.0');

      return {
        title: context.get('title', quiz),
        author: context.get('author.display_name', quiz)
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
      return context.get('.quizzes.trending', null, []).map(function(quiz) {
        return context.get('title', quiz);
      });
    });

    var res2 = createContext(store, function(context) {
      return context.get('.quizzes.trending', null, []).map(function(quiz) {
        return context.get('author.display_name', quiz);
      });
    });

    var res3 = createContext(store, function(context) {
      return context.get('.quizzes.personality', null, []).map(function(quiz) {
        return context.get('title', quiz);
      });
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
