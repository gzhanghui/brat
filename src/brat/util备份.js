import $ from 'jquery';
import chroma from 'chroma-js';

var Util = (function(window, undefined) {

  var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var cmp = function(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
  };


  var unitAgo = function(n, unit) {
    if (n === 1) return '' + n + ' ' + unit + ' ago';
    return '' + n + ' ' + unit + 's ago';
  };

  var formatTimeAgo = function(time) {
    if (time === -1000) {
      return 'never';
    }

    var nowDate = new Date();
    var now = nowDate.getTime();
    var diff = Math.floor((now - time) / 1000);
    if (!diff) return 'just now';
    if (diff < 60) return unitAgo(diff, 'second');
    diff = Math.floor(diff / 60);
    if (diff < 60) return unitAgo(diff, 'minute');
    diff = Math.floor(diff / 60);
    if (diff < 24) return unitAgo(diff, 'hour');
    diff = Math.floor(diff / 24);
    if (diff < 7) return unitAgo(diff, 'day');
    if (diff < 28) return unitAgo(Math.floor(diff / 7), 'week');
    var thenDate = new Date(time);
    var result = thenDate.getDate() + ' ' + monthNames[thenDate.getMonth()];
    if (thenDate.getYear() != nowDate.getYear()) {
      result += ' ' + thenDate.getFullYear();
    }
    return result;
  };

  var realBBox = function(span) {
    var box = span.rect.getBBox();
    var chunkTranslation = span.chunk.translation;
    var rowTranslation = span.chunk.row.translation;
    box.x += chunkTranslation.x + rowTranslation.x;
    box.y += chunkTranslation.y + rowTranslation.y;
    return box;
  };

  var escapeHTML = function(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };

  var escapeHTMLandQuotes = function(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');
  };

  var escapeHTMLwithNewlines = function(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
  };

  var escapeQuotes = function(str) {
    // we only use double quotes for HTML attributes
    return str.replace(/\"/g, '&quot;');
  };

  var getSpanLabels = function(spanTypes, spanType) {
    var type = spanTypes[spanType];
    return type && type.labels || [];
  };

  var spanDisplayForm = function(spanTypes, spanType) {
    var labels = getSpanLabels(spanTypes, spanType);
    return labels[0] || spanType;
  };

  var getArcLabels = function(spanTypes, spanType, arcType, relationTypesHash) {
    var type = spanTypes[spanType];
    var arcTypes = type && type.arcs || [];
    var arcDesc = null;
    // also consider matches without suffix number, if any
    var noNumArcType;
    if (arcType) {
      var splitType = arcType.match(/^(.*?)(\d*)$/);
      noNumArcType = splitType[1];
    }
    $.each(arcTypes, function(arcno, arcDescI) {
      if (arcDescI.type === arcType || arcDescI.type === noNumArcType) {
        arcDesc = arcDescI;
        return false;
      }
    });
    if (!arcDesc) {
      arcDesc = $.extend({}, relationTypesHash[arcType] || relationTypesHash[noNumArcType]);
    }
    return arcDesc && arcDesc.labels || [];
  };

  var arcDisplayForm = function(spanTypes, spanType, arcType, relationTypesHash) {
    var labels = getArcLabels(spanTypes, spanType, arcType, relationTypesHash);
    return labels[0] || arcType;
  };

  // TODO: switching to use of $.param(), this function should
  // be deprecated and removed.
  var objectToUrlStr = function(o) {
var    a = [];
    $.each(o, function(key, value) {
      a.push(key + '=' + encodeURIComponent(value));
    });
    return a.join('&');
  };

  // color name RGB list, converted from
  // http://www.w3schools.com/html/html_colornames.asp
  // with perl as
  //     perl -e 'print "var colors = {\n"; while(<>) { /(\S+)\s+\#([0-9a-z]{2})([0-9a-z]{2})([0-9a-z]{2})\s*/i or die "Failed to parse $_"; ($r,$g,$b)=(hex($2),hex($3),hex($4)); print "    '\''",lc($1),"'\'':\[$r,$g,$b\],\n" } print "};\n" '
  var colors = {
    'aliceblue': [240, 248, 255],
    'antiquewhite': [250, 235, 215],
    'aqua': [0, 255, 255],
    'aquamarine': [127, 255, 212],
    'azure': [240, 255, 255],
    'beige': [245, 245, 220],
    'bisque': [255, 228, 196],
    'black': [0, 0, 0],
    'blanchedalmond': [255, 235, 205],
    'blue': [0, 0, 255],
    'blueviolet': [138, 43, 226],
    'brown': [165, 42, 42],
    'burlywood': [222, 184, 135],
    'cadetblue': [95, 158, 160],
    'chartreuse': [127, 255, 0],
    'chocolate': [210, 105, 30],
    'coral': [255, 127, 80],
    'cornflowerblue': [100, 149, 237],
    'cornsilk': [255, 248, 220],
    'crimson': [220, 20, 60],
    'cyan': [0, 255, 255],
    'darkblue': [0, 0, 139],
    'darkcyan': [0, 139, 139],
    'darkgoldenrod': [184, 134, 11],
    'darkgray': [169, 169, 169],
    'darkgrey': [169, 169, 169],
    'darkgreen': [0, 100, 0],
    'darkkhaki': [189, 183, 107],
    'darkmagenta': [139, 0, 139],
    'darkolivegreen': [85, 107, 47],
    'darkorange': [255, 140, 0],
    'darkorchid': [153, 50, 204],
    'darkred': [139, 0, 0],
    'darksalmon': [233, 150, 122],
    'darkseagreen': [143, 188, 143],
    'darkslateblue': [72, 61, 139],
    'darkslategray': [47, 79, 79],
    'darkslategrey': [47, 79, 79],
    'darkturquoise': [0, 206, 209],
    'darkviolet': [148, 0, 211],
    'deeppink': [255, 20, 147],
    'deepskyblue': [0, 191, 255],
    'dimgray': [105, 105, 105],
    'dimgrey': [105, 105, 105],
    'dodgerblue': [30, 144, 255],
    'firebrick': [178, 34, 34],
    'floralwhite': [255, 250, 240],
    'forestgreen': [34, 139, 34],
    'fuchsia': [255, 0, 255],
    'gainsboro': [220, 220, 220],
    'ghostwhite': [248, 248, 255],
    'gold': [255, 215, 0],
    'goldenrod': [218, 165, 32],
    'gray': [128, 128, 128],
    'grey': [128, 128, 128],
    'green': [0, 128, 0],
    'greenyellow': [173, 255, 47],
    'honeydew': [240, 255, 240],
    'hotpink': [255, 105, 180],
    'indianred': [205, 92, 92],
    'indigo': [75, 0, 130],
    'ivory': [255, 255, 240],
    'khaki': [240, 230, 140],
    'lavender': [230, 230, 250],
    'lavenderblush': [255, 240, 245],
    'lawngreen': [124, 252, 0],
    'lemonchiffon': [255, 250, 205],
    'lightblue': [173, 216, 230],
    'lightcoral': [240, 128, 128],
    'lightcyan': [224, 255, 255],
    'lightgoldenrodyellow': [250, 250, 210],
    'lightgray': [211, 211, 211],
    'lightgrey': [211, 211, 211],
    'lightgreen': [144, 238, 144],
    'lightpink': [255, 182, 193],
    'lightsalmon': [255, 160, 122],
    'lightseagreen': [32, 178, 170],
    'lightskyblue': [135, 206, 250],
    'lightslategray': [119, 136, 153],
    'lightslategrey': [119, 136, 153],
    'lightsteelblue': [176, 196, 222],
    'lightyellow': [255, 255, 224],
    'lime': [0, 255, 0],
    'limegreen': [50, 205, 50],
    'linen': [250, 240, 230],
    'magenta': [255, 0, 255],
    'maroon': [128, 0, 0],
    'mediumaquamarine': [102, 205, 170],
    'mediumblue': [0, 0, 205],
    'mediumorchid': [186, 85, 211],
    'mediumpurple': [147, 112, 216],
    'mediumseagreen': [60, 179, 113],
    'mediumslateblue': [123, 104, 238],
    'mediumspringgreen': [0, 250, 154],
    'mediumturquoise': [72, 209, 204],
    'mediumvioletred': [199, 21, 133],
    'midnightblue': [25, 25, 112],
    'mintcream': [245, 255, 250],
    'mistyrose': [255, 228, 225],
    'moccasin': [255, 228, 181],
    'navajowhite': [255, 222, 173],
    'navy': [0, 0, 128],
    'oldlace': [253, 245, 230],
    'olive': [128, 128, 0],
    'olivedrab': [107, 142, 35],
    'orange': [255, 165, 0],
    'orangered': [255, 69, 0],
    'orchid': [218, 112, 214],
    'palegoldenrod': [238, 232, 170],
    'palegreen': [152, 251, 152],
    'paleturquoise': [175, 238, 238],
    'palevioletred': [216, 112, 147],
    'papayawhip': [255, 239, 213],
    'peachpuff': [255, 218, 185],
    'peru': [205, 133, 63],
    'pink': [255, 192, 203],
    'plum': [221, 160, 221],
    'powderblue': [176, 224, 230],
    'purple': [128, 0, 128],
    'red': [255, 0, 0],
    'rosybrown': [188, 143, 143],
    'royalblue': [65, 105, 225],
    'saddlebrown': [139, 69, 19],
    'salmon': [250, 128, 114],
    'sandybrown': [244, 164, 96],
    'seagreen': [46, 139, 87],
    'seashell': [255, 245, 238],
    'sienna': [160, 82, 45],
    'silver': [192, 192, 192],
    'skyblue': [135, 206, 235],
    'slateblue': [106, 90, 205],
    'slategray': [112, 128, 144],
    'slategrey': [112, 128, 144],
    'snow': [255, 250, 250],
    'springgreen': [0, 255, 127],
    'steelblue': [70, 130, 180],
    'tan': [210, 180, 140],
    'teal': [0, 128, 128],
    'thistle': [216, 191, 216],
    'tomato': [255, 99, 71],
    'turquoise': [64, 224, 208],
    'violet': [238, 130, 238],
    'wheat': [245, 222, 179],
    'white': [255, 255, 255],
    'whitesmoke': [245, 245, 245],
    'yellow': [255, 255, 0],
    'yellowgreen': [154, 205, 50],
  };

  var strToRgb = function(color) {
    // 尝试直接解析颜色字符串
    try {
      const colorObj = chroma(color);
      // 如果解析成功，则返回 RGB 数组
      return colorObj.rgb().array();
    } catch (e) {
      console.log(color.trim().toLowerCase());
      // 如果解析失败，则检查是否是命名颜色
      return colors[color.trim().toLowerCase()];
    }
  };

  var rgbToStr = function(rgb) {
    // 使用 chroma-js 将 RGB 数组转换为十六进制字符串
    return chroma(rgb).hex();
  };

  var rgbToHsl = function(rgb) {
    return chroma(rgb).hsl()
  };

  var hslToRgb = function(hsl) {
    const rgb = chroma(`hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)`).rgb();
    return [Math.round(rgb[0] * 255), Math.round(rgb[1] * 255), Math.round(rgb[2] * 255)];
  };

  var adjustLightnessCache = {};

  var adjustColorLightness = function(colorStr, adjust) {
    // 缓存键，包含颜色和亮度调整值
    const cacheKey = `${colorStr}-${adjust}`;
    // 如果缓存中存在，直接返回缓存结果
    if (cacheKey in adjustLightnessCache) {
      return adjustLightnessCache[cacheKey];
    }
    // 将颜色字符串转换为 RGB
    const rgb = strToRgb(colorStr);
    if (rgb === undefined) {
      // 如果转换失败，返回原始颜色字符串
      adjustLightnessCache[cacheKey] = colorStr;
      return colorStr;
    }
    // 使用 chroma-js 调整颜色的亮度
    const adjustedColor = chroma(rgb).luminance(adjust).css();
    // 将结果存入缓存
    adjustLightnessCache[cacheKey] = adjustedColor;
    // 返回调整后的颜色字符串
    return adjustedColor;
  };

  // Partially stolen from: http://documentcloud.github.com/underscore/
  // MIT-License
  // TODO: Mention in LICENSE.md
  var isEqual = function(a, b) {
    // Check object identity.
    if (a === b) return true;
    // Different types?
    var atype = typeof (a), btype = typeof (b);
    if (atype != btype) return false;
    // Basic equality test (watch out for coercions).
    if (a === b) return true;
    // One is falsy and the other truthy.
    if ((!a && b) || (a && !b)) return false;
    // If a is not an object by this point, we can't handle it.
    if (atype !== 'object') return false;
    // Check for different array lengths before comparing contents.
    if (a.length && (a.length !== b.length)) return false;
    // Nothing else worked, deep compare the contents.
    for (var key in b) if (!(key in a)) return false;
    // Recursive comparison of contents.
    for (var key in a) if (!(key in b) || !isEqual(a[key], b[key])) return false;
    return true;
  };

  var keyValRE = /^([^=]+)=(.*)$/; // key=value
  var isDigitsRE = /^[0-9]+$/;

  var deparam = function(str) {
    var args = str.split('&');
    var len = args.length;
    if (!len) return null;
    var result = {};
    for (var i = 0; i < len; i++) {
      var parts = args[i].match(keyValRE);
      if (!parts || parts.length != 3) break;
      var val = [];
      var arr = parts[2].split(',');
      var sublen = arr.length;
      for (var j = 0; j < sublen; j++) {
        var innermost = [];
        // map empty arguments ("" in URL) to empty arrays
        // (innermost remains [])
        if (arr[j].length) {
          var arrsplit = arr[j].split('~');
          var subsublen = arrsplit.length;
          for (var k = 0; k < subsublen; k++) {
            if (arrsplit[k].match(isDigitsRE)) {
              // convert digits into ints ...
              innermost.push(parseInt(arrsplit[k], 10));
            } else {
              // ... anything else remains a string.
              innermost.push(arrsplit[k]);
            }
          }
        }
        val.push(innermost);
      }
      result[parts[1]] = val;
    }
    return result;
  };

  var paramArray = function(val) {
    val = val || [];
    var len = val.length;
    var arr = [];
    for (var i = 0; i < len; i++) {
      if ($.isArray(val[i])) {
        arr.push(val[i].join('~'));
      } else {
        // non-array argument; this is an error from the caller
        console.error('param: Error: received non-array-in-array argument [', i, ']', ':', val[i], '(fix caller)');
      }
    }
    return arr;
  };

  var param = function(args) {
    if (!args) return '';
    var vals = [];
    for (var key in args) {
      if (args.hasOwnProperty(key)) {
        var val = args[key];
        if (val === undefined) {
          console.error('Error: received argument', key, 'with value', val);
          continue;
        }
        // values normally expected to be arrays, but some callers screw
        // up, so check
        if ($.isArray(val)) {
          var arr = paramArray(val);
          vals.push(key + '=' + arr.join(','));
        } else {
          // non-array argument; this is an error from the caller
          console.error('param: Error: received non-array argument', key, ':', val, '(fix caller)');
        }
      }
    }
    return vals.join('&');
  };

  var profiles = {};
  var profileStarts = {};
  var profileOn = false;
  var profileEnable = function(on) {
    if (on === undefined) on = true;
    profileOn = on;
  }; // profileEnable
  var profileClear = function() {
    if (!profileOn) return;
    profiles = {};
    profileStarts = {};
  }; // profileClear
  var profileStart = function(label) {
    if (!profileOn) return;
    profileStarts[label] = new Date();
  }; // profileStart
  var profileEnd = function(label) {
    if (!profileOn) return;
    var profileElapsed = new Date() - profileStarts[label];
    if (!profiles[label]) profiles[label] = 0;
    profiles[label] += profileElapsed;
  }; // profileEnd
  var profileReport = function() {
    if (!profileOn) return;
    if (window.console) {
      $.each(profiles, function(label, time) {
        console.log('profile ' + label, time);
      });
      console.log('-------');
    }
  }; // profileReport

  // container: ID or jQuery element
  // collData: the collection data (in the format of the result of
  //   http://.../brat/ajax.cgi?action=getCollectionInformation&collection=...
  // docData: the document data (in the format of the result of
  //   http://.../brat/ajax.cgi?action=getDocument&collection=...&document=...
  // returns the embedded visualizer's dispatcher object
  var embed = function(container, collData, docData, webFontURLs) {
    var dispatcher = new Dispatcher();
    var visualizer = new Visualizer(dispatcher, container, webFontURLs);
    docData.collection = null;
    dispatcher.post('collectionLoaded', [collData]);
    dispatcher.post('requestRenderData', [docData]);
    return dispatcher;
  };

  // container: ID or jQuery element
  // collDataURL: the URL of the collection data, or collection data
  //   object (if pre-fetched)
  // docDataURL: the url of the document data (if pre-fetched, use
  //   simple `embed` instead)
  // callback: optional; the callback to call afterwards; it will be
  //   passed the embedded visualizer's dispatcher object
  var embedByURL = function(container, collDataURL, docDataURL, callback) {
    var collData, docData;
    var handler = function() {
      if (collData && docData) {
        var dispatcher = embed(container, collData, docData);
        if (callback) callback(dispatcher);
      }
    };
    if (typeof (container) === 'string') {
      $.getJSON(collDataURL, function(data) {
        collData = data;
        handler();
      });
    } else {
      collData = collDataURL;
    }
    $.getJSON(docDataURL, function(data) {
      docData = data;
      handler();
    });
  };


  return {
    profileEnable: profileEnable,
    profileClear: profileClear,
    profileStart: profileStart,
    profileEnd: profileEnd,
    profileReport: profileReport,
    formatTimeAgo: formatTimeAgo,
    realBBox: realBBox,
    getSpanLabels: getSpanLabels,
    spanDisplayForm: spanDisplayForm,
    getArcLabels: getArcLabels,
    arcDisplayForm: arcDisplayForm,
    escapeQuotes: escapeQuotes,
    escapeHTML: escapeHTML,
    escapeHTMLandQuotes: escapeHTMLandQuotes,
    escapeHTMLwithNewlines: escapeHTMLwithNewlines,
    cmp: cmp,
    rgbToHsl: rgbToHsl,
    hslToRgb: hslToRgb,
    adjustColorLightness: adjustColorLightness,
    objectToUrlStr: objectToUrlStr,
    isEqual: isEqual,
    paramArray: paramArray,
    param: param,
    deparam: deparam,
    embed: embed,
    embedByURL: embedByURL,
  };

})(window);

export default Util;