function pathMixins(Path) {
  Path.prototype._path = '';
  Path.prototype.M = function (x, y, relative) {
    relative = Array.isArray(x) ? y : relative;
    return this.coords(relative ? 'm' : 'M', x, y);
  };
  Path.prototype.line = function (x, y, relative) {
    relative = Array.isArray(x) ? y : relative;
    return this.coords(relative ? 'l' : 'L', x, y);
  };

  Path.prototype.curveQ = function (x1, y1, x, y, relative) {
    relative = Array.isArray(x1) ? y1 : relative;
    return this.coords(relative ? 'q' : 'Q', x1, y1, x, y);
  };

  Path.prototype.curveC = function (x1, y1, x2, y2, x, y, relative) {
    relative = Array.isArray(x1) ? y1 : relative;
    return this.coords(relative ? 'c' : 'C', x1, y1, x2, y2, x, y);
  };
  Path.prototype.coords = function (cmd, x1, y1, x2, y2, x3, y3) {
    if (Array.isArray(x1)) {
      for (let i = 0; i < x1.length; i++) {
        const cs = x1[i];
        this._path += (i === 0 ? cmd : ' ') + cs[0] + ',' + cs[1] + (cs.length < 4 ? '' : ' ' + cs[2] + ',' + cs[3] + (cs.length < 6 ? '' : ' ' + cs[4] + ',' + cs[5]));
      }
    } else {
      this._path += cmd + x1 + ',' + y1 + (x2 == null ? '' : ' ' + x2 + ',' + y2 + (x3 == null ? '' : ' ' + x3 + ',' + y3));
    }
    return this;
  };
  return Path;
}

export default pathMixins;
