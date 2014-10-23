/**
 * Module dependencies
 */

var HyperMap = require('hyper-map');
var debug = require('debug')('hyper-store');
var Emitter = require('component-emitter');

/**
 * Expose HyperStore
 */

module.exports = HyperStore;

/**
 * Create a HyperStore
 *
 * @param {HyperClient} client
 * @param {Object?} resources
 */

function HyperStore(client, resources) {
  if (!client) throw new Error('A HyperClient must be passed to HyperStore');

  this._activePaths = {};
  this._prevActivePaths = {};

  this._reqs = {};
  this.size = 0;
  this._client = client;

  this._map = new HyperMap(resources);
  this._map.on('request', this._watch.bind(this));
}
Emitter(HyperStore.prototype);

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
  debug('getting', path);
  return this._map.get(path, scope, delim);
};

/**
 * Watch an href
 *
 * @param {String} href
 * @api private
 */

HyperStore.prototype._watch = function(href) {
  debug('watching', href);
  this._activePaths[href] = true;
  if (this._reqs[href]) return;
  this.size++;
  this._reqs[href] = this._fetch(href) || function() {};
};

/**
 * Fetch an href from the HyperClient
 *
 * @param {String} href
 * @api private
 */

HyperStore.prototype._fetch = function(href) {
  debug('fetching', href);
  var self = this;
  var map = self._map;

  return href === '.' ?
    self._client.root(fn) :
    self._client.get(href, fn);

  function fn(err, res) {
    if (err) map.error(href, err);
    map.set(href, res);
    self._changed();
  };
};

/**
 * Start the watch cycle
 *
 * @return {HyperStore}
 */

HyperStore.prototype.begin =
HyperStore.prototype.start = function() {
  debug('starting cycle');
  this._needsRefresh = false;
  this._active = true;
  this._prevActivePaths = this._activePaths;
  this._activePaths = {};
  return this;
};

/**
 * End the watch cycle
 *
 * @return {HyperStore}
 */

HyperStore.prototype.end =
HyperStore.prototype.stop = function() {
  var self = this;
  debug('stopping cycle');
  self._active = false;

  self._clearStalePaths();
  if (!self._needsRefresh) return self._checkComplete();

  // give any remaining requests a chance to get into the next refresh
  defer(function() {
    self._needsRefresh = false;
    self._changed();
  });

  return self;
};

/**
 * Verify all of the requests have been completed and emit "complete" event
 *
 * @api private
 */

HyperStore.prototype._checkComplete = function() {
  // TODO make this more robust - it should compare the hrefs
  if (this.size === this._map.size) this.emit('complete');
  return this;
};

/**
 * Mark the store as dirty and emit a "changed" event
 *
 * @api private
 */

HyperStore.prototype._changed = function() {
  this._needsRefresh = true;

  // only emit the event if the rendering is not active
  if (!this._active) this.emit('change');
  return this;
};

/**
 * Clear any stale HyperClient subscriptions from the previous render
 *
 * @api private
 */

HyperStore.prototype._clearStalePaths = function() {
  var self = this;
  var active = self._activePaths;
  var prev = self._prevActivePaths;
  var reqs = self._reqs;
  var map = self._map;

  for (var href in prev) {
    // the href is still needed
    if (active[href]) continue;

    debug('clearing stale path', href);

    // unsubscribe from changes to the href
    reqs[href]();
    self.size--;
    delete reqs[href];

    map.delete(href);
  }
}

/**
 * Defer execution
 *
 * @param {Function} fn
 */

function defer(fn) {
  if (typeof requestAnimationFrame !== 'undefined') return requestAnimationFrame(fn);
  if (typeof mozRequestAnimationFrame !== 'undefined') return mozRequestAnimationFrame(fn);
  if (typeof webkitRequestAnimationFrame !== 'undefined') return webkitRequestAnimationFrame(fn);
  if (typeof setImmediate !== 'undefined') return setImmediate(fn);
  return setTimeout(fn, 0);
}
