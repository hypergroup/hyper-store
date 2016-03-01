/**
 * Module dependencies
 */

var Counter = require('reference-count');
var Request = require('hyper-path');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var raf = require('raf');
var debounce = require('debounce');
var now = require('performance-now');
var Client = require('./lib/client');
var Context = require('./lib/context');

/**
 * Expose HyperStore
 */

exports = module.exports = HyperStore;
exports['default'] = exports;

function noop() {}

/**
 * Create a HyperStore
 *
 * @param {HyperClient} client
 * @param {Object?} resources
 */

function HyperStore(client, resources) {
  if (!client) throw new Error('A HyperClient must be passed to HyperStore');
  var self = this;
  EventEmitter.call(self);
  this._client = client;
  var counter = self._counter = new Counter();
  counter.on('garbage', self._ongarbage.bind(self));
  counter.on('resource', self._onresource.bind(self));

  self._id = 0;
  self._callbacks = {};
  self._errors = {};
  self._resources = {};
  self._protoMap = {};
  self._subs = {};
  self._pending = 0;
  self._garbage = {};
  self._interval = setInterval(function() {
    self.gc();
  }, 1000);

  // create a global context for simple cases
  var context = this._globalContext = this.context(this.emit.bind(this, 'change'));
  this.start = context.start.bind(context);
  this.stop = context.stop.bind(context);
}
inherits(HyperStore, EventEmitter);

/**
 * Create a child context
 *
 * @param {Function} fn
 * @return {Context}
 */

HyperStore.prototype.context = function(fn) {
  var counter = this._counter;
  var id = this._id++;

  this._callbacks[id] = debounce(fn, 10);

  var sweep = this._sweep.bind(this, counter, id);
  var destroy = this._destroy.bind(this, counter, id);

  return new Context(sweep, this._fetch.bind(this), this._setTimeout.bind(this), destroy);
};

HyperStore.prototype._sweep = function(counter, id) {
  return counter.sweep(id);
};

HyperStore.prototype._destroy = function(counter, id) {
  return counter.destroy(id);
};

/**
 * Get a value at 'path' in 'scope'
 *
 * @param {String} path
 * @param {Object} scope
 * @param {String} delim
 * @return {Any}
 * @api public
 */

HyperStore.prototype.get = function(path, scope, delim) {
  return this._globalContext.req(path, scope, delim);
};

/**
 * Reload an href in the store
 */

HyperStore.prototype.reload = function(href) {
  var self = this;
  if (self._garbage[href]) return;
  if (self._client.clear) return self._client.clear(href, function() {self._onresource(href)});
  self._onresource(href);
};

HyperStore.prototype._fetch = function(path, parent, sweep, delim) {
  var client = new Client(sweep, this._resources, this._errors, this._protoMap);
  var req = new Request(path, client, delim);
  req.scope(parent || {});

  return req.get(function(err, value) {
    if (err) throw err;
    var isLoaded = client.isLoaded;
    return {
      completed: isLoaded,
      isLoaded: isLoaded,
      request: req,
      value: value
    };
  });
};

HyperStore.prototype._onresource = function(href) {
  var self = this;
  var errors = self._errors;
  var resources = self._resources;
  var client = self._client;
  var actors = self._counter.actors;

  if (self._garbage[href]) {
    delete self._garbage[href];
    return;
  }

  var withProto = self._protoMap[href] || href;

  var begin = now();

  self._subs[href] = href === Client.ROOT_RESOURCE ?
    client.root(cb) :
    client.get(withProto, cb);

  clearTimeout(self._timeout);

  self._pending++;

  function cb(err, body) {
    var time = now() - begin;

    errors[href] = err;
    resources[href] = {value: body};

    self._pending--;

    for (var actor in actors) {
      actors[actor][href] && raf(function() {
        self._callbacks[this](withProto, body);
      }.bind(actor));
    }

    self.emit('change', withProto, time, err);
  }
};

HyperStore.prototype._ongarbage = function(href) {
  this._garbage[href] = 1;
};

HyperStore.prototype.gc = function() {
  var self = this;
  var garbage = self._garbage;
  if (!garbage.length) return self;
  for (var k in garbage) {
    self.gcResource(k);
  }
  self._garbage = {};
  return self;
};

HyperStore.prototype.gcResource = function(href) {
  var self = this;
  delete self._resources[href];
  delete self._callbacks[href];
  var sub = self._subs[href];
  if (typeof sub === 'function') sub();
  delete self._subs[href];
  delete self._protoMap[href];
  delete self._errors[href];
};

/**
 * Not a huge fan of this...
 */

HyperStore.prototype._setTimeout = function() {
  var self = this;
  clearTimeout(self._timeout);

  self._timeout = setTimeout(function() {
    if (self._pending === 0) self.emit('complete');
  }, 50);
};

/**
 * Get an object async
 */

HyperStore.prototype.getAsync = function(renderFn, cb) {
  if (typeof renderFn === 'object') {
    renderFn = fetchTemplate.bind(null, Object.keys(renderFn), renderFn);
  }

  var called = false;

  function render() {
    context.start();
    try {
      var res = renderFn(context.get, context);
    } catch (err) {
      return cb(err);
    }

    if (!context.stop() || called) return;
    called = true;
    context.destroy();

    cb(null, res);
  }

  var context = this.context(render);
  render();
};

function fetchTemplate(keys, obj, $get) {
  var target = {};

  for (var i = 0, v, k; i < keys.length; i++) {
    k = keys[i];
    v = obj[k];
    if (typeof v === 'function') {
      target[k] = v($get);
      continue;
    }

    if (typeof v === 'string') v = v.split('.');
    target[k] = !v[0] ? $get(v) : $get(v.slice(1), v[0]);
  };

  return target;
}
