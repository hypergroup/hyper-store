/**
 * Module dependencies
 */

var Counter = require('reference-count');
var Request = require('hyper-path');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var raf = require('raf');
var debounce = require('debounce');

/**
 * Expose HyperStore
 */

module.exports = HyperStore;

/**
 * Define enums
 */

var ROOT_RESOURCE = '__root__';

function noop() {}

/**
 * Create a HyperStore
 *
 * @param {HyperClient} client
 * @param {Object?} resources
 */

function HyperStore(client, resources) {
  if (!client) throw new Error('A HyperClient must be passed to HyperStore');
  EventEmitter.call(this);
  this._client = client;
  var counter = this._counter = new Counter();
  counter.on('garbage', this._ongarbage.bind(this));
  counter.on('resource', this._onresource.bind(this));

  this._id = 0;
  this._callbacks = {};
  this._errors = {};
  this._resources = {};
  this._subs = {};
  this._pending = 0;

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

HyperStore.prototype._fetch = function(path, parent, sweep, delim) {
  var client = new Client(sweep, this._resources, this._errors);
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

  self._subs[href] = href === ROOT_RESOURCE ?
    client.root(cb) :
    client.get(href, cb);

  clearTimeout(self._timeout);

  self._pending++;

  function cb(err, body) {
    errors[href] = err;
    resources[href] = {value: body};

    self._pending--;

    for (var actor in actors) {
      actors[actor][href] && raf(function() {
        self._callbacks[this](href, body);
      }.bind(actor));
    }

    self.emit('change');
  }
};

HyperStore.prototype._ongarbage = function(href) {
  var self = this;
  delete self._resources[href];
  delete self._callbacks[href];
  var sub = self._subs[href];
  if (typeof sub === 'function') sub();
  delete self._subs[href];
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






function Context(start, fetch, done, destroy) {
  this._start = start;
  this._fetch = fetch;
  this.destroy = destroy;
  this.done = done;
  this.get = this.get.bind(this);
}

Context.prototype.get = function(path, parent, fallback, delim) {
  var res = this._fetch(path, parent, this._sweep, delim);
  if (res.isLoaded) return typeof res.value === 'undefined' ? fallback : res.value;
  this.isLoaded = false;
  return fallback;
};

Context.prototype.req = function(path, parent, delim) {
  var res = this._fetch(path, parent, this._sweep, delim);
  if (!res.isLoaded) this.isLoaded = false;
  return res;
};

Context.prototype.start = function() {
  this.isLoaded = true;
  return this._sweep = this._start();
};

Context.prototype.stop = function() {
  this._sweep.done();
  delete this._sweep;
  this.done();
  return this.isLoaded;
};









/**
 * Create a synchronous HyperClient
 */

function Client(sweep, resources, errors) {
  if (!sweep) throw new Error('the context has not been started');
  this._sweep = sweep;
  this._resources = resources;
  this._errors = errors;
  this.isLoaded = true;
}

/**
 * Request the root resource
 *
 * @param {Function} cb
 */

Client.prototype.root = function(cb) {
  return this.get(ROOT_RESOURCE, cb);
};

/**
 * Request a resource
 *
 * @param {String} href
 * @param {Function} cb
 */

Client.prototype.get = function(href, cb) {
  var self = this;
  self._sweep.count(href);

  var res = self._resources[href];
  if (res) return cb(null, res.value, null, null, false);

  var err = self._errors[href];
  if (err) return cb(err);

  this.isLoaded = false;
  return cb();
};
