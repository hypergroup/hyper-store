module.exports = Context;

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
