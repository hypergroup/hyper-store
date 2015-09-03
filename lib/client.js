module.exports = Client;

Client.ROOT_RESOURCE = '__root__';

/**
 * Create a synchronous HyperClient
 */

function Client(sweep, resources, errors, protoMap) {
  if (!sweep) throw new Error('the context has not been started');
  this._sweep = sweep;
  this._resources = resources;
  this._errors = errors;
  this._protoMap = protoMap;
  this.isLoaded = true;
}

/**
 * Request the root resource
 *
 * @param {Function} cb
 */

Client.prototype.root = function(cb) {
  return this.get(Client.ROOT_RESOURCE, cb);
};

/**
 * Request a resource
 *
 * @param {String} href
 * @param {Function} cb
 */

Client.prototype.get = function(href, cb) {
  var self = this;
  var withoutProto = (href || '').replace(/^[^:]+:/, '');
  self._protoMap[withoutProto] = self._protoMap[withoutProto] || href;

  self._sweep.count(withoutProto);

  var res = self._resources[withoutProto];
  if (res) return cb(null, res.value, null, null, false);

  var err = self._errors[withoutProto];
  if (err) return cb(err);

  this.isLoaded = false;
  return cb();
};
