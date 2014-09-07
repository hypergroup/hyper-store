var should = require('should');
var Store = require('../');

describe('hyper-store', function() {
  describe('render loop', function() {
    it('should call render until complete', function(done) {
      testStore({
        '/': {
          users: {
            href: '/users'
          }
        },
        '/users': {
          collection: [
            {href: '/users/1'},
            {href: '/users/2'},
            {href: '/users/3'}
          ]
        },
        '/users/1': {
          name: 'Mike'
        },
        '/users/2': {
          name: 'Brannon'
        },
        '/users/3': {
          name: 'Cameron'
        }
      }, function(store) {
        var $users = {
          users: store.get('.users').value
        };

        return [
          store.get('users.0.name', $users).value,
          store.get('users.1.name', $users).value,
          store.get('users.2.name', $users).value
        ];
      }, function(err, res) {
        res.should.eql(['Mike', 'Brannon', 'Cameron']);
        done();
      });
    });
  });
});

function testStore(resources, render, cb) {
  var client = TestClient(resources);
  var store = new Store(client);
  var res, error;
  store.on('change', function() {
    try {
      res = render(store);
    } catch (err) {
      error = err;
    }
  });
  store.on('complete', function() {
    cb(error, res);
  });
  render(store);
}

function TestClient(resources) {
  return {
    root: function(cb) {
      setTimeout(function() {
        cb(null, resources['/']);
      }, time());
    },
    get: function(href, cb) {
      setTimeout(function() {
        cb(null, resources[href]);
      }, time());
    }
  };
}

function time() {
  return Math.floor(Math.random() * 10);
}
